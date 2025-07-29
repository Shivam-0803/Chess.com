// WebRTC configuration
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.ekiga.net' },
    { urls: 'stun:stun.ideasip.com' },
    { urls: 'stun:stun.schlund.de' },
    // Free TURN server from Twilio (limited, but helps for testing)
    {
      urls: "turn:global.turn.twilio.com:3478?transport=udp",
      username: "f4e5a2b3c1d0",  // These are dummy credentials
      credential: "6789012345abcdef"
    }
  ],
  iceCandidatePoolSize: 10
};

// Global variables
let localStream = null;
let peerConnection = null;
let localVideo = null;
let remoteVideo = null;
let localRole = null;
let connectionStatus = "disconnected"; // Track connection status

// Check if running in secure context
const isSecureContext = window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost';

// Detect mobile browser
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Debug logger
function logDebug(type, message, data = null) {
  const emoji = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
    connection: "🔌",
    media: "🎥",
    ice: "🧊"
  };
  
  console.log(`${emoji[type] || "🔍"} ${message}`, data || "");
  
  // Update UI status if needed
  if (type === "connection" || type === "error") {
    updateConnectionStatus(message);
  }
}

// Update connection status in UI
function updateConnectionStatus(status) {
  connectionStatus = status;
  
  // Update main connection status
  if (window.chatFunctions && window.chatFunctions.updateConnectionStatus) {
    const isConnected = status.includes("connected") || status.includes("established");
    window.chatFunctions.updateConnectionStatus(status, isConnected);
  }
}

// Check browser compatibility
function checkBrowserCompatibility() {
  // Check for secure context
  if (!isSecureContext) {
    return {
      compatible: false,
      message: "WebRTC requires a secure context (HTTPS). Please use HTTPS or localhost."
    };
  }
  
  // Check for basic WebRTC support
  if (!window.RTCPeerConnection) {
    return {
      compatible: false,
      message: "Your browser doesn't support WebRTC. Please use Chrome, Firefox, Safari, or Edge."
    };
  }
  
  // Check for getUserMedia
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    // Try older versions
    navigator.mediaDevices = {};
    navigator.mediaDevices.getUserMedia = function(constraints) {
      const getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      
      if (!getUserMedia) {
        return Promise.reject(new Error("getUserMedia is not implemented in this browser"));
      }
      
      return new Promise(function(resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
    
    return {
      compatible: true,
      message: "Using legacy media API"
    };
  }
  
  return {
    compatible: true,
    message: "Browser fully supports WebRTC"
  };
}

// Initialize WebRTC
function initializeWebRTC() {
  localVideo = document.getElementById('localVideo');
  remoteVideo = document.getElementById('remoteVideo');

  // Check browser compatibility first
  const compatibility = checkBrowserCompatibility();
  logDebug("info", `Browser compatibility: ${compatibility.message}`);
  
  if (!compatibility.compatible) {
    alert(compatibility.message);
    document.getElementById('startVideo').textContent = "Not Supported";
    document.getElementById('startVideo').disabled = true;
    document.getElementById('toggleMute').disabled = true;
    document.getElementById('toggleCamera').disabled = true;
    return;
  }

  // Create connection status element
  createConnectionStatusElement();

  // Set up UI controls
  document.getElementById('startVideo').addEventListener('click', startVideo);
  document.getElementById('toggleMute').addEventListener('click', toggleMute);
  document.getElementById('toggleCamera').addEventListener('click', toggleCamera);

  // Socket event listeners
  socket.on('webrtc_offer', handleVideoOffer);
  socket.on('webrtc_answer', handleVideoAnswer);
  socket.on('webrtc_ice_candidate', handleNewICECandidate);
  socket.on('webrtc_disconnect', handleDisconnect);

  // Add video element event listeners
  localVideo.addEventListener('loadedmetadata', () => {
    logDebug("media", "Local video stream dimensions:", 
      `${localVideo.videoWidth}x${localVideo.videoHeight}`);
  });
  
  remoteVideo.addEventListener('loadedmetadata', () => {
    logDebug("media", "Remote video stream dimensions:", 
      `${remoteVideo.videoWidth}x${remoteVideo.videoHeight}`);
    
    // Hide fallback when video loads
    const fallback = remoteVideo.parentElement.querySelector('.video-fallback');
    if (fallback) {
      fallback.style.display = 'none';
    }
  });

  localVideo.addEventListener('loadedmetadata', () => {
    logDebug("media", "Local video stream dimensions:", 
      `${localVideo.videoWidth}x${localVideo.videoHeight}`);
    
    // Hide fallback when video loads
    const fallback = localVideo.parentElement.querySelector('.video-fallback');
    if (fallback) {
      fallback.style.display = 'none';
    }
  });

  // Assign role and auto-start if role is already known
  if (playerRole) {
    localRole = playerRole;
    logDebug("info", "Role already set:", localRole);
    setTimeout(() => startVideo(), 500);
  }

  socket.on('playerRole', function (role) {
    localRole = role;
    logDebug("info", "Received role:", localRole);
    
    // Update player role display
    if (window.chatFunctions && window.chatFunctions.updatePlayerRoleDisplay) {
      window.chatFunctions.updatePlayerRoleDisplay(role);
    }
    
    if (localVideo && remoteVideo) {
      setTimeout(() => startVideo(), 500);
    }
  });
}

// Create connection status element (now handled in HTML)
function createConnectionStatusElement() {
  // Status element is now part of the main HTML
  return;
}

// Start video stream
async function startVideo() {
  try {
    logDebug("media", "Starting local video...");
    updateConnectionStatus("initializing");
    
    // Check if we're in a secure context
    if (!isSecureContext) {
      logDebug("error", "Not in a secure context. WebRTC requires HTTPS.");
      alert("WebRTC requires a secure connection (HTTPS). Video chat may not work on insecure connections.");
    }
    
    // Set video constraints based on device
    const videoConstraints = {
      width: isMobile ? { ideal: 640 } : { ideal: 1280 },
      height: isMobile ? { ideal: 480 } : { ideal: 720 },
      facingMode: "user"
    };
    
    try {
      // Try with both video and audio
      localStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: true
      });
      localVideo.srcObject = localStream;
      localVideo.classList.add('has-video');
      logDebug("success", "Camera and microphone access granted");
    } catch (mediaError) {
      logDebug("error", "First media error:", mediaError.name);
      
      // Show more detailed error message
      const errorDetails = {
        NotAllowedError: "Permission denied. Please allow camera and microphone access in your browser settings.",
        NotFoundError: "No camera or microphone found on your device.",
        NotReadableError: "Could not access your camera/microphone. It might be used by another application.",
        OverconstrainedError: "Your camera doesn't meet the required constraints.",
        AbortError: "Media capture was aborted.",
        SecurityError: "Media capture was blocked due to security restrictions.",
        TypeError: "No media tracks of the requested type available."
      };
      
      const errorMessage = errorDetails[mediaError.name] || mediaError.message || "Unknown media error";
      logDebug("error", errorMessage);
      
      // Try with just video if both failed
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        localVideo.srcObject = localStream;
        localVideo.classList.add('has-video');
        logDebug("warning", "Microphone access failed. Video-only mode enabled.");
        alert("Microphone access failed. Video-only mode enabled.");
      } catch (videoError) {
        logDebug("error", "Video-only error:", videoError.name);
        
        // Try with just audio if video failed
        try {
          localStream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true
          });
          localVideo.srcObject = localStream;
          logDebug("warning", "Camera access failed. Audio-only mode enabled.");
          alert("Camera access failed. Audio-only mode enabled.");
        } catch (audioError) {
          logDebug("error", "Audio-only error:", audioError.name);
          
          // All attempts failed
          if (confirm("Could not access camera or microphone. Do you want to continue without video chat?")) {
            document.getElementById('startVideo').textContent = "No Access";
            document.getElementById('startVideo').disabled = true;
            document.getElementById('toggleMute').disabled = true;
            document.getElementById('toggleCamera').disabled = true;
            updateConnectionStatus("no media access");
            return;
          } else {
            return;
          }
        }
      }
    }

    // Show available tracks
    if (localStream) {
      logDebug("info", "Available tracks:", 
        localStream.getTracks().map(t => `${t.kind}: ${t.label} (enabled: ${t.enabled})`));
    }

    if (localRole === 'w' || localRole === 'b') {
      createPeerConnection();

      if (localRole === 'w') {
        logDebug("connection", "White role - sending offer...");
        createAndSendOffer();
      }
    }
  } catch (err) {
    logDebug("error", "Error accessing media devices:", err.message);
    alert(`Could not set up video: ${err.message}`);
  }
}

// Create a peer connection
function createPeerConnection() {
  if (peerConnection) {
    peerConnection.close();
  }

  logDebug("connection", "Creating peer connection...");
  updateConnectionStatus("connecting");
  peerConnection = new RTCPeerConnection(configuration);

  // Add all local tracks to the peer connection
  if (localStream) {
    localStream.getTracks().forEach(track => {
      logDebug("media", `Adding ${track.kind} track to peer connection`);
      peerConnection.addTrack(track, localStream);
    });
  }

  // Handle ICE candidates
  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      logDebug("ice", "Sending ICE candidate:", event.candidate.candidate.substring(0, 50) + "...");
      socket.emit('webrtc_ice_candidate', {
        candidate: event.candidate,
        role: localRole
      });
    } else {
      logDebug("ice", "All ICE candidates gathered");
    }
  };

  // Handle incoming tracks
  peerConnection.ontrack = event => {
    logDebug("media", `Remote ${event.track.kind} track received`);
    
    // Always use the most recent stream
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.classList.add('has-video');
    
    // Log when remote tracks start/end
    event.track.onunmute = () => {
      logDebug("media", `Remote ${event.track.kind} track unmuted`);
      updateConnectionStatus("media streaming");
    };
    
    event.track.onmute = () => {
      logDebug("media", `Remote ${event.track.kind} track muted`);
    };
    
    event.track.onended = () => {
      logDebug("media", `Remote ${event.track.kind} track ended`);
      if (event.track.kind === 'video') {
        // Try to reconnect if video track ends unexpectedly
        setTimeout(() => {
          if (peerConnection.connectionState === 'connected' && !remoteVideo.srcObject) {
            logDebug("connection", "Video track ended unexpectedly, attempting reconnection");
            reconnect();
          }
        }, 2000);
      }
    };
  };

  // Monitor ICE connection state
  peerConnection.oniceconnectionstatechange = () => {
    logDebug("connection", `ICE connection state: ${peerConnection.iceConnectionState}`);
    updateConnectionStatus(peerConnection.iceConnectionState);
    
    // Handle connection problems
    if (peerConnection.iceConnectionState === 'failed') {
      logDebug("connection", "ICE connection failed, attempting restart");
      peerConnection.restartIce();
    } else if (['disconnected', 'closed'].includes(peerConnection.iceConnectionState)) {
      handleDisconnect();
    }
  };
  
  // Monitor signaling state
  peerConnection.onsignalingstatechange = () => {
    logDebug("connection", `Signaling state: ${peerConnection.signalingState}`);
  };
  
  // Monitor overall connection state
  peerConnection.onconnectionstatechange = () => {
    logDebug("connection", `Connection state: ${peerConnection.connectionState}`);
    
    if (peerConnection.connectionState === 'connected') {
      updateConnectionStatus("established");
      
      // Check if we have video tracks
      const remoteTracks = remoteVideo.srcObject?.getTracks() || [];
      const hasVideoTrack = remoteTracks.some(track => track.kind === 'video');
      
      if (!hasVideoTrack) {
        logDebug("warning", "Connected but no remote video track");
      }
    }
    
    if (peerConnection.connectionState === 'failed') {
      logDebug("error", "Connection failed, attempting reconnection");
      reconnect();
    } else if (['disconnected', 'closed'].includes(peerConnection.connectionState)) {
      handleDisconnect();
    }
  };
}

// Function to attempt reconnection
function reconnect() {
  logDebug("connection", "Attempting reconnection");
  updateConnectionStatus("reconnecting");
  
  // Close existing connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  
  // Create new connection
  createPeerConnection();
  
  // Reinitiate connection based on role
  if (localRole === 'w') {
    createAndSendOffer();
  }
}

// Create and send offer with improved options
async function createAndSendOffer() {
  try {
    updateConnectionStatus("creating offer");
    
    // Create offer with specific options for better compatibility
    const offerOptions = {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
      iceRestart: true,
      voiceActivityDetection: true
    };
    
    const offer = await peerConnection.createOffer(offerOptions);
    
    // Set local description
    await peerConnection.setLocalDescription(offer);
    logDebug("connection", "Local description set");

    // Wait a short time to gather some ICE candidates before sending offer
    setTimeout(() => {
      logDebug("connection", "Sending offer");
      socket.emit('webrtc_offer', {
        sdp: peerConnection.localDescription,
        role: localRole
      });
    }, 500);
  } catch (err) {
    logDebug("error", "Error creating offer:", err.message);
  }
}

// Handle received offer
async function handleVideoOffer(offer) {
  if (localRole !== 'b') return;

  logDebug("connection", "Received offer");
  updateConnectionStatus("received offer");

  try {
    // Ensure we have a stream
    if (!localStream) {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ 
          video: true, 
          audio: true 
        });
        localVideo.srcObject = localStream;
        localVideo.classList.add('has-video');
        logDebug("success", "Media access granted for answer");
      } catch (err) {
        logDebug("error", "Error accessing media devices for answer:", err.message);
        
        // Try with just audio as fallback
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ 
            video: false, 
            audio: true 
          });
          localVideo.srcObject = localStream;
          logDebug("warning", "Video failed, audio-only mode for answer");
          alert('Could not access camera. Audio-only mode enabled.');
        } catch (audioErr) {
          logDebug("error", "Complete media access failure:", audioErr.message);
          alert('Could not access camera or microphone. Please check permissions.');
          return;
        }
      }
    }

    // Create new peer connection if needed
    if (!peerConnection) {
      createPeerConnection();
    }

    // Make sure the offer has the correct format
    updateConnectionStatus("processing offer");
    
    // Validate offer
    if (!offer.sdp || !offer.sdp.type || offer.sdp.type !== 'offer') {
      throw new Error("Invalid offer received");
    }
    
    const offerDesc = new RTCSessionDescription(offer.sdp);
    
    // Set remote description (the offer)
    await peerConnection.setRemoteDescription(offerDesc);
    logDebug("connection", "Remote description set (offer)");
    
    // Process any queued ICE candidates
    processIceCandidateQueue();

    // Create answer with options
    updateConnectionStatus("creating answer");
    const answerOptions = {
      voiceActivityDetection: true
    };
    const answer = await peerConnection.createAnswer(answerOptions);
    
    // Set local description (our answer)
    await peerConnection.setLocalDescription(answer);
    logDebug("connection", "Local description set (answer)");

    // Wait a moment to gather ICE candidates before sending answer
    setTimeout(() => {
      logDebug("connection", "Sending answer");
      socket.emit('webrtc_answer', {
        sdp: peerConnection.localDescription,
        role: localRole
      });
    }, 500);
  } catch (err) {
    logDebug("error", "Error handling offer:", err.message);
    alert(`Connection error: ${err.message}. Try refreshing the page.`);
  }
}

// Handle received answer
async function handleVideoAnswer(answer) {
  if (localRole !== 'w') return;

  logDebug("connection", "Received answer");
  updateConnectionStatus("received answer");

  try {
    // Validate answer
    if (!answer.sdp || !answer.sdp.type || answer.sdp.type !== 'answer') {
      throw new Error("Invalid answer received");
    }
    
    // Make sure the answer has the correct format
    const answerDesc = new RTCSessionDescription(answer.sdp);
    
    // Set remote description (the answer)
    await peerConnection.setRemoteDescription(answerDesc);
    logDebug("connection", "Remote description set (answer)");
    
    // Process any queued ICE candidates
    processIceCandidateQueue();
    
    updateConnectionStatus("connecting");
    
    // Check connection after a short delay
    setTimeout(() => {
      if (peerConnection && peerConnection.connectionState !== 'connected') {
        logDebug("warning", "Connection not established after answer, checking ICE");
        
        // If we have no remote tracks after 5 seconds, try reconnecting
        if (!remoteVideo.srcObject || !remoteVideo.srcObject.getTracks().length) {
          logDebug("warning", "No remote tracks received, attempting reconnection");
          reconnect();
        }
      }
    }, 5000);
  } catch (err) {
    logDebug("error", "Error handling answer:", err.message);
  }
}

// Handle ICE candidate from remote
async function handleNewICECandidate(candidate) {
  if (!candidate || !candidate.candidate) {
    logDebug("ice", "Received empty ICE candidate");
    return;
  }
  
  try {
    if (!peerConnection) {
      logDebug("warning", "Received ICE candidate but no peer connection exists");
      return;
    }
    
    // Store candidates if remote description is not set yet
    if (peerConnection.remoteDescription === null) {
      logDebug("ice", "Remote description not set, queuing ICE candidate");
      
      // Create a queue if it doesn't exist
      if (!window.iceCandidateQueue) {
        window.iceCandidateQueue = [];
      }
      
      // Queue the candidate
      window.iceCandidateQueue.push(candidate);
      return;
    }
    
    logDebug("ice", "Received ICE candidate:", candidate.candidate.candidate?.substring(0, 50) + "...");
    
    const iceCandidate = new RTCIceCandidate(candidate.candidate);
    await peerConnection.addIceCandidate(iceCandidate);
    logDebug("ice", "ICE candidate added successfully");
  } catch (err) {
    logDebug("error", "Error adding ICE candidate:", err.message);
  }
}

// Function to process any queued ICE candidates
async function processIceCandidateQueue() {
  if (!window.iceCandidateQueue || !window.iceCandidateQueue.length) return;
  
  logDebug("ice", `Processing ${window.iceCandidateQueue.length} queued ICE candidates`);
  
  while (window.iceCandidateQueue.length) {
    const candidate = window.iceCandidateQueue.shift();
    try {
      const iceCandidate = new RTCIceCandidate(candidate.candidate);
      await peerConnection.addIceCandidate(iceCandidate);
    } catch (err) {
      logDebug("error", "Error processing queued ICE candidate:", err.message);
    }
  }
}

// Handle disconnection
function handleDisconnect() {
  logDebug("connection", "Disconnected");
  updateConnectionStatus("disconnected");
  
  if (remoteVideo) {
    remoteVideo.srcObject = null;
    remoteVideo.classList.remove('has-video');
  }

  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
    
  // Notify server about disconnection
  if (socket && localRole) {
    socket.emit('webrtc_disconnect');
  }
}

// Add window unload handler to notify about disconnection
window.addEventListener('beforeunload', () => {
  if (socket && localRole) {
    socket.emit('webrtc_disconnect');
  }
});

// Toggle mute
function toggleMute() {
  if (localStream) {
    const audioTracks = localStream.getAudioTracks();
    const muteBtn = document.getElementById('toggleMute');

    if (audioTracks.length > 0) {
      const isEnabled = audioTracks[0].enabled;
      audioTracks[0].enabled = !isEnabled;
      
      logDebug("media", `Microphone ${isEnabled ? 'muted' : 'unmuted'}`);
      muteBtn.textContent = isEnabled ? 'Unmute' : 'Mute';
      muteBtn.classList.toggle('bg-red-500');
      muteBtn.classList.toggle('bg-green-500');
    } else {
      alert("No audio track available to mute/unmute");
    }
  }
}

// Toggle camera
function toggleCamera() {
  if (localStream) {
    const videoTracks = localStream.getVideoTracks();
    const cameraBtn = document.getElementById('toggleCamera');

    if (videoTracks.length > 0) {
      const isEnabled = videoTracks[0].enabled;
      videoTracks[0].enabled = !isEnabled;
      
      logDebug("media", `Camera ${isEnabled ? 'disabled' : 'enabled'}`);
      cameraBtn.textContent = isEnabled ? 'Turn Camera On' : 'Turn Camera Off';
      cameraBtn.classList.toggle('bg-red-500');
      cameraBtn.classList.toggle('bg-green-500');
    } else {
      alert("No video track available to toggle");
    }
  }
}

// Initialize once DOM is ready
document.addEventListener('DOMContentLoaded', initializeWebRTC);
