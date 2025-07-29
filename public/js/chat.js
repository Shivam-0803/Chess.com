
// Chat functionality
let playerRole = null;
let socket = null;

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  initializeChat();
});

function initializeChat() {
  const chatInput = document.getElementById('chatInput');
  const sendButton = document.getElementById('sendMessage');
  const chatMessages = document.getElementById('chatMessages');

  if (!chatInput || !sendButton || !chatMessages) {
    console.log('Chat elements not found, retrying...');
    setTimeout(initializeChat, 100);
    return;
  }

  // Get socket from global scope or create new connection
  if (typeof io !== 'undefined') {
    if (!socket) {
      socket = io();
    }
  } else {
    console.error('Socket.IO not loaded');
    return;
  }

  // Socket event listeners for chat
  socket.on('playerRole', function(role) {
    playerRole = role;
    updatePlayerRoleDisplay(role);
  });

  socket.on('chatMessage', function(data) {
    displayMessage(data.message, data.sender, data.role);
  });

  socket.on('playerJoined', function(data) {
    displaySystemMessage(`${data.role === 'w' ? 'White' : 'Black'} player joined the game`);
  });

  socket.on('playerLeft', function(data) {
    displaySystemMessage(`${data.role === 'w' ? 'White' : 'Black'} player left the game`);
  });

  // Send message on button click
  sendButton.addEventListener('click', sendMessage);

  // Send message on Enter key
  chatInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      sendMessage();
    }
  });

  // Auto-resize chat input
  chatInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 100) + 'px';
  });
}

function sendMessage() {
  const chatInput = document.getElementById('chatInput');
  const message = chatInput.value.trim();

  if (!message || !socket || !playerRole) {
    return;
  }

  if (message.length > 200) {
    alert('Message too long! Maximum 200 characters.');
    return;
  }

  // Send message to server
  socket.emit('chatMessage', {
    message: message,
    role: playerRole,
    timestamp: Date.now()
  });

  // Clear input
  chatInput.value = '';
  chatInput.style.height = 'auto';

  // Display message locally
  displayMessage(message, 'You', playerRole, true);
}

function displayMessage(message, sender, role, isOwn = false) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // Remove welcome message if it exists
  const welcomeMsg = chatMessages.querySelector('.text-center');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;

  const senderSpan = document.createElement('div');
  senderSpan.className = 'message-sender';
  senderSpan.textContent = isOwn ? 'You' : `${sender} (${role === 'w' ? 'White' : 'Black'})`;

  const messageText = document.createElement('div');
  messageText.textContent = message;

  messageDiv.appendChild(senderSpan);
  messageDiv.appendChild(messageText);
  chatMessages.appendChild(messageDiv);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Limit messages to prevent memory issues
  const messages = chatMessages.querySelectorAll('.message');
  if (messages.length > 100) {
    messages[0].remove();
  }
}

function displaySystemMessage(message) {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'text-center text-gray-500 text-sm py-2 border-l-2 border-blue-500 pl-3 my-2';
  messageDiv.innerHTML = `<i class="fas fa-info-circle mr-1"></i>${message}`;

  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updatePlayerRoleDisplay(role) {
  const playerRoleElement = document.getElementById('playerRole');
  if (playerRoleElement) {
    const roleText = role === 'w' ? 'White Player' : role === 'b' ? 'Black Player' : 'Spectator';
    const roleIcon = role === 'w' ? 'fas fa-chess-king' : role === 'b' ? 'fas fa-chess-queen' : 'fas fa-eye';
    playerRoleElement.innerHTML = `<i class="${roleIcon} mr-1"></i>${roleText}`;
  }
}

// Update connection status
function updateConnectionStatus(status, isConnected = false) {
  const statusElement = document.getElementById('connectionStatus');
  if (!statusElement) return;

  const indicator = statusElement.querySelector('.status-indicator');
  const text = statusElement.querySelector('span:last-child');

  if (indicator && text) {
    // Remove all status classes
    indicator.classList.remove('status-connected', 'status-connecting', 'status-disconnected');
    
    if (isConnected) {
      indicator.classList.add('status-connected');
      text.textContent = 'Connected';
    } else if (status.includes('connecting') || status.includes('checking')) {
      indicator.classList.add('status-connecting');
      text.textContent = 'Connecting...';
    } else {
      indicator.classList.add('status-disconnected');
      text.textContent = status;
    }
  }
}

// Export functions for use in other scripts
window.chatFunctions = {
  displayMessage,
  displaySystemMessage,
  updateConnectionStatus,
  updatePlayerRoleDisplay
};
