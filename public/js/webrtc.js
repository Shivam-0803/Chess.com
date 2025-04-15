// WebRTC configuration
const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };
  
  // Global variables
  let localStream = null;
  let peerConnection = null;
  let localVideo = null;
  let remoteVideo = null;
  let localRole = null;
  
  // Initialize WebRTC
  function initializeWebRTC() {
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
  
    // Set up UI controls
    document.getElementById('startVideo').addEventListener('click', startVideo);
    document.getElementById('toggleMute').addEventListener('click', toggleMute);
    document.getElementById('toggleCamera').addEventListener('click', toggleCamera);
  
    // Socket event listeners
    socket.on('webrtc_offer', handleVideoOffer);
    socket.on('webrtc_answer', handleVideoAnswer);
    socket.on('webrtc_ice_candidate', handleNewICECandidate);
    socket.on('webrtc_disconnect', handleDisconnect);
  
    // Assign role and auto-start if role is already known
    if (playerRole) {
      localRole = playerRole;
      console.log("🧩 Role already set:", localRole);
      setTimeout(() => startVideo(), 500);
    }
  
    socket.on('playerRole', function (role) {
      localRole = role;
      console.log("🧩 Received role:", localRole);
      if (localVideo && remoteVideo) {
        setTimeout(() => startVideo(), 500);
      }
    });
  }
  
  // Start video stream
  async function startVideo() {
    try {
      console.log("🎥 Starting local video...");
      localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
  
      localVideo.srcObject = localStream;
  
      if (localRole === 'w' || localRole === 'b') {
        createPeerConnection();
  
        if (localRole === 'w') {
          console.log("📡 White role - sending offer...");
          createAndSendOffer();
        }
      }
  
      document.getElementById('videoControls').classList.remove('hidden');
    } catch (err) {
      console.error('🚫 Error accessing media devices:', err);
      alert('Could not access camera or microphone. Please check permissions.');
    }
  }
  
  // Create a peer connection
  function createPeerConnection() {
    if (peerConnection) {
      peerConnection.close();
    }
  
    console.log("📞 Creating peer connection...");
    peerConnection = new RTCPeerConnection(configuration);
  
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }
  
    peerConnection.onicecandidate = event => {
      if (event.candidate) {
        console.log("🧊 Sending ICE candidate:", event.candidate);
        socket.emit('webrtc_ice_candidate', {
          candidate: event.candidate,
          role: localRole
        });
      }
    };
  
    peerConnection.ontrack = event => {
      console.log("🎥 Remote track received");
      remoteVideo.srcObject = event.streams[0];
    };
  
    peerConnection.onconnectionstatechange = () => {
      console.log("🔁 Connection state changed:", peerConnection.connectionState);
      if (['disconnected', 'failed'].includes(peerConnection.connectionState)) {
        handleDisconnect();
      }
    };
  }
  
  // Create and send offer
  async function createAndSendOffer() {
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
  
      console.log("📡 Sending offer:", offer);
      socket.emit('webrtc_offer', {
        sdp: peerConnection.localDescription,
        role: localRole
      });
    } catch (err) {
      console.error('🚫 Error creating offer:', err);
    }
  }
  
  // Handle received offer
  async function handleVideoOffer(offer) {
    if (localRole !== 'b') return;
  
    console.log("📞 Received offer:", offer);
  
    try {
      // Ensure we have a stream
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject = localStream;
      }
  
      if (!peerConnection) {
        createPeerConnection();
      }
  
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer.sdp));
  
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
  
      console.log("📡 Sending answer:", answer);
      socket.emit('webrtc_answer', {
        sdp: peerConnection.localDescription,
        role: localRole
      });
    } catch (err) {
      console.error('🚫 Error handling offer:', err);
    }
  }
  
  
  // Handle received answer
  async function handleVideoAnswer(answer) {
    if (localRole !== 'w') return;
  
    console.log("✅ Received answer:", answer);
  
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer.sdp));
    } catch (err) {
      console.error('🚫 Error handling answer:', err);
    }
  }
  
  // Handle ICE candidate from remote
  async function handleNewICECandidate(candidate) {
    console.log("🧊 Received ICE candidate:", candidate);
  
    try {
      if (peerConnection) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate.candidate));
      }
    } catch (err) {
      console.error('🚫 Error adding ICE candidate:', err);
    }
  }
  
  // Handle disconnection
  function handleDisconnect() {
    console.log("🔌 Disconnected");
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }
  
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  }
  
  // Toggle mute
  function toggleMute() {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const muteBtn = document.getElementById('toggleMute');
  
      if (audioTracks.length > 0) {
        const isEnabled = audioTracks[0].enabled;
        audioTracks[0].enabled = !isEnabled;
  
        muteBtn.textContent = isEnabled ? 'Unmute' : 'Mute';
        muteBtn.classList.toggle('bg-red-500');
        muteBtn.classList.toggle('bg-green-500');
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
  
        cameraBtn.textContent = isEnabled ? 'Turn Camera On' : 'Turn Camera Off';
        cameraBtn.classList.toggle('bg-red-500');
        cameraBtn.classList.toggle('bg-green-500');
      }
    }
  }
  
  // Initialize once DOM is ready
  document.addEventListener('DOMContentLoaded', initializeWebRTC);
  