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
  const statusElement = document.getElementById('connectionStatus');
  if (statusElement) {
    statusElement.textContent = status;
    
    // Update status color
    statusElement.className = "text-xs font-medium px-2 py-1 rounded-full";
    if (status.includes("connected") || status.includes("established")) {
      statusElement.classList.add("bg-green-100", "text-green-800");
    } else if (status.includes("connecting") || status.includes("checking")) {
      statusElement.classList.add("bg-yellow-100", "text-yellow-800");
    } else {
      statusElement.classList.add("bg-red-100", "text-red-800");
    }
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
    if (localVideo && remoteVideo) {
      setTimeout(() => startVideo(), 500);
    }
  });
}

// Create connection status element
function createConnectionStatusElement() {
  // Check if element already exists
  if (document.getElementById('connectionStatus')) return;
  
  const videoControls = document.getElementById('videoControls');
  if (videoControls) {
    const statusContainer = document.createElement('div');
    statusContainer.className = "flex items-center justify-center mt-2";
    
    const statusLabel = document.createElement('span');
    statusLabel.className = "text-xs text-gray-400 mr-2";
    statusLabel.textContent = "Connection:";
    
    const statusElement = document.createElement('span');
    statusElement.id = "connectionStatus";
    statusElement.className = "text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-800";
    statusElement.textContent = "disconnected";
    
    statusContainer.appendChild(statusLabel);
    statusContainer.appendChild(statusElement);
    videoControls.appendChild(statusContainer);
  }
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
    
    try {
      // Try with both video and audio
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
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

  if (localStream) {
    localStream.getTracks().forEach(track => {
      logDebug("media", `Adding ${track.kind} track to peer connection`);
      peerConnection.addTrack(track, localStream);
    });
  }

  peerConnection.onicecandidate = event => {
    if (event.candidate) {
      logDebug("ice", "Sending ICE candidate:", event.candidate.candidate.substring(0, 50) + "...");
      socket.emit('webrtc_ice_candidate', {
        candidate: event.candidate,
        role: localRole
      });
    }
  };

  peerConnection.ontrack = event => {
    logDebug("media", `Remote ${event.track.kind} track received`);
    remoteVideo.srcObject = event.streams[0];
    remoteVideo.classList.add('has-video');
    
    // Log when remote tracks start/end
    event.track.onunmute = () => {
      logDebug("media", `Remote ${event.track.kind} track unmuted`);
    };
    
    event.track.onmute = () => {
      logDebug("media", `Remote ${event.track.kind} track muted`);
    };
    
    event.track.onended = () => {
      logDebug("media", `Remote ${event.track.kind} track ended`);
    };
  };

  peerConnection.oniceconnectionstatechange = () => {
    logDebug("connection", `ICE connection state: ${peerConnection.iceConnectionState}`);
    updateConnectionStatus(peerConnection.iceConnectionState);
    
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.iceConnectionState)) {
      handleDisconnect();
    }
  };
  
  peerConnection.onsignalingstatechange = () => {
    logDebug("connection", `Signaling state: ${peerConnection.signalingState}`);
  };
  
  peerConnection.onconnectionstatechange = () => {
    logDebug("connection", `Connection state: ${peerConnection.connectionState}`);
    
    if (peerConnection.connectionState === 'connected') {
      updateConnectionStatus("established");
    }
    
    if (['disconnected', 'failed', 'closed'].includes(peerConnection.connectionState)) {
      handleDisconnect();
    }
  };
}

// Create and send offer
async function createAndSendOffer() {
  try {
    updateConnectionStatus("creating offer");
    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    await peerConnection.setLocalDescription(offer);

    logDebug("connection", "Sending offer");
    socket.emit('webrtc_offer', {
      sdp: peerConnection.localDescription,
      role: localRole
    });
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
      } catch (err) {
        logDebug("error", "Error accessing media devices:", err.message);
        alert('Could not access camera or microphone. Please check permissions.');
        return;
      }
    }

    if (!peerConnection) {
      createPeerConnection();
    }

    // Make sure the offer has the correct format
    updateConnectionStatus("processing offer");
    const offerDesc = new RTCSessionDescription(offer.sdp);
    await peerConnection.setRemoteDescription(offerDesc);

    updateConnectionStatus("creating answer");
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    logDebug("connection", "Sending answer");
    socket.emit('webrtc_answer', {
      sdp: peerConnection.localDescription,
      role: localRole
    });
  } catch (err) {
    logDebug("error", "Error handling offer:", err.message);
  }
}

// Handle received answer
async function handleVideoAnswer(answer) {
  if (localRole !== 'w') return;

  logDebug("connection", "Received answer");
  updateConnectionStatus("received answer");

  try {
    // Make sure the answer has the correct format
    const answerDesc = new RTCSessionDescription(answer.sdp);
    await peerConnection.setRemoteDescription(answerDesc);
    updateConnectionStatus("connecting");
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
  
  logDebug("ice", "Received ICE candidate:", candidate.candidate.candidate?.substring(0, 50) + "...");

  try {
    if (peerConnection && candidate && candidate.candidate) {
      const iceCandidate = new RTCIceCandidate(candidate.candidate);
      await peerConnection.addIceCandidate(iceCandidate);
    }
  } catch (err) {
    logDebug("error", "Error adding ICE candidate:", err.message);
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
