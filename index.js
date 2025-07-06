const messageInput = document.querySelector(".message-input");
const chatbotBody = document.querySelector(".chatbot-messages");
const sendMessageButton = document.querySelector("#send-message");
const closeButton = document.querySelector("#close-chatbot");
const chatForm = document.querySelector(".chat-form");
const emojiButton = document.querySelector("#emoji-button");
const fileButton = document.querySelector("#file-button");
const fileInput = document.querySelector("#file-input");
const emojiPicker = document.querySelector("#emoji-picker");
const emojiGrid = document.querySelector("#emoji-grid");
const firebaseButton = document.querySelector("#firebase-button");
const filePreviewArea = document.querySelector("#file-preview-area");
const removeFileButton = document.querySelector("#remove-file");

// API Configuration
const API_KEY = "AIzaSyAbKbDfO3zXS7j7_kyupUmCuVxuQiRzaao";
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

// Chat Storage - Temporary Variable
let chatHistory = {
    sessionId: generateSessionId(),
    startTime: new Date().toISOString(),
    messages: [],
    metadata: {
        userAgent: navigator.userAgent,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
    }
};

// Firebase Configuration (will be initialized when user connects)
let firebaseConfig = null;
let db = null;
let isFirebaseConnected = false;

const userData = {
    message: null,
    file: null
};

// Generate unique session ID
function generateSessionId() {
    return 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Store message in chat history
const storeMessage = (type, content, file = null, timestamp = new Date().toISOString()) => {
    const message = {
        id: generateMessageId(),
        type: type, // 'user' or 'bot'
        content: content,
        timestamp: timestamp,
        file: file ? {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified
        } : null
    };
    
    chatHistory.messages.push(message);
    
    // Auto-save to Firebase if connected
    if (isFirebaseConnected) {
        saveChatToFirebase();
    }
    
    // Log for debugging
    console.log('Chat History Updated:', chatHistory);
    
    return message;
};

// Generate unique message ID
function generateMessageId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Get chat history
const getChatHistory = () => {
    return { ...chatHistory };
};

// Clear chat history
const clearChatHistory = () => {
    chatHistory = {
        sessionId: generateSessionId(),
        startTime: new Date().toISOString(),
        messages: [],
        metadata: {
            userAgent: navigator.userAgent,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        }
    };
    
    console.log('Chat history cleared');
};

// Export chat history as JSON
const exportChatHistory = () => {
    const dataStr = JSON.stringify(chatHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `chat_history_${chatHistory.sessionId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// Firebase Integration Functions
const initializeFirebase = async (config) => {
    try {
        // Import Firebase modules dynamically
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
        const { getFirestore, collection, addDoc, doc, setDoc, onSnapshot } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        // Initialize Firebase
        const app = initializeApp(config);
        db = getFirestore(app);
        firebaseConfig = config;
        isFirebaseConnected = true;
        
        // Update UI
        updateFirebaseButton(true);
        
        // Save current chat history to Firebase
        await saveChatToFirebase();
        
        console.log('Firebase connected successfully');
        showNotification('✅ Firebase connected successfully!', 'success');
        
        return true;
    } catch (error) {
        console.error('Firebase initialization error:', error);
        showNotification('❌ Firebase connection failed: ' + error.message, 'error');
        return false;
    }
};

// Save chat to Firebase
const saveChatToFirebase = async () => {
    if (!isFirebaseConnected || !db) return;
    
    try {
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        await setDoc(doc(db, 'chats', chatHistory.sessionId), {
            ...chatHistory,
            lastUpdated: new Date().toISOString()
        });
        
        console.log('Chat saved to Firebase');
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        showNotification('⚠️ Failed to save to Firebase', 'warning');
    }
};

// Load chat from Firebase
const loadChatFromFirebase = async (sessionId) => {
    if (!isFirebaseConnected || !db) return null;
    
    try {
        const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
        
        const docRef = doc(db, 'chats', sessionId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            return docSnap.data();
        } else {
            console.log('No chat found with this session ID');
            return null;
        }
    } catch (error) {
        console.error('Error loading from Firebase:', error);
        return null;
    }
};

// Show notification
const showNotification = (message, type = 'info') => {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-weight: 500;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;
    
    // Set background color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
};

// Update Firebase button appearance
const updateFirebaseButton = (connected) => {
    const button = firebaseButton;
    if (connected) {
        button.innerHTML = '<i class="bi bi-cloud-check"></i>';
        button.title = 'Firebase Connected - Click to disconnect';
        button.classList.add('connected');
    } else {
        button.innerHTML = '<i class="bi bi-cloud"></i>';
        button.title = 'Connect to Firebase';
        button.classList.remove('connected');
    }
};

// Handle Firebase connection
const handleFirebaseConnection = () => {
    if (isFirebaseConnected) {
        // Disconnect Firebase
        disconnectFirebase();
    } else {
        // Show Firebase configuration modal
        showFirebaseConfigModal();
    }
};

// Disconnect Firebase
const disconnectFirebase = () => {
    firebaseConfig = null;
    db = null;
    isFirebaseConnected = false;
    updateFirebaseButton(false);
    showNotification('🔌 Disconnected from Firebase', 'info');
};

// Show Firebase configuration modal
const showFirebaseConfigModal = () => {
    const modal = document.createElement('div');
    modal.className = 'firebase-modal';
    modal.innerHTML = `
        <div class="firebase-modal-content">
            <div class="firebase-modal-header">
                <h3>Connect to Firebase</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="firebase-modal-body">
                <p>To enable persistent chat storage, please provide your Firebase configuration:</p>
                <textarea id="firebase-config" placeholder='Paste your Firebase config object here:
{
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project-id",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "123456789",
  "appId": "your-app-id"
}'></textarea>
                <div class="firebase-modal-actions">
                    <button id="connect-firebase" class="primary-btn">Connect</button>
                    <button id="cancel-firebase" class="secondary-btn">Cancel</button>
                </div>
            </div>
        </div>
    `;
    
    // Add modal styles
    const style = document.createElement('style');
    style.textContent = `
        .firebase-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.3s ease-out;
        }
        
        .firebase-modal-content {
            background: white;
            border-radius: 12px;
            width: 90%;
            max-width: 500px;
            max-height: 80vh;
            overflow: hidden;
            animation: slideUp 0.3s ease-out;
        }
        
        .firebase-modal-header {
            padding: 20px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .firebase-modal-header h3 {
            margin: 0;
            color: #374151;
        }
        
        .close-modal {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #6b7280;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: all 0.2s ease;
        }
        
        .close-modal:hover {
            background: #f3f4f6;
            color: #374151;
        }
        
        .firebase-modal-body {
            padding: 20px;
        }
        
        .firebase-modal-body p {
            margin: 0 0 15px 0;
            color: #6b7280;
            line-height: 1.5;
        }
        
        #firebase-config {
            width: 100%;
            height: 200px;
            border: 2px solid #e5e7eb;
            border-radius: 8px;
            padding: 12px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            resize: vertical;
            margin-bottom: 20px;
        }
        
        #firebase-config:focus {
            outline: none;
            border-color: #4f46e5;
        }
        
        .firebase-modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        
        .primary-btn, .secondary-btn {
            padding: 10px 20px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s ease;
        }
        
        .primary-btn {
            background: #4f46e5;
            color: white;
        }
        
        .primary-btn:hover {
            background: #4338ca;
        }
        
        .secondary-btn {
            background: #f3f4f6;
            color: #374151;
        }
        
        .secondary-btn:hover {
            background: #e5e7eb;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        
        @keyframes slideUp {
            from { transform: translateY(30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(modal);
    
    // Event listeners
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
    
    modal.querySelector('#cancel-firebase').addEventListener('click', () => {
        document.body.removeChild(modal);
        document.head.removeChild(style);
    });
    
    modal.querySelector('#connect-firebase').addEventListener('click', async () => {
        const configText = modal.querySelector('#firebase-config').value.trim();
        
        try {
            const config = JSON.parse(configText);
            const success = await initializeFirebase(config);
            
            if (success) {
                document.body.removeChild(modal);
                document.head.removeChild(style);
            }
        } catch (error) {
            showNotification('❌ Invalid Firebase configuration format', 'error');
        }
    });
    
    // Close on backdrop click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
            document.head.removeChild(style);
        }
    });
};

// Emoji data organized by categories
const emojiData = {
    smileys: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏'],
    people: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '👊', '✊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅'],
    nature: ['🌟', '⭐', '🌙', '☀️', '⛅', '🌤️', '⛈️', '🌧️', '❄️', '☃️', '⛄', '🌈', '🔥', '💧', '🌊', '🎄', '🌲', '🌳', '🌴', '🌱', '🌿', '☘️', '🍀', '🎋', '🍃', '🍂', '🍁', '🌾', '🌺', '🌻', '🌹', '🥀'],
    food: ['🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🥚', '🍳', '🥘', '🍲', '🥗', '🍿', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌭', '🥪', '🍞', '🥖', '🥨', '🧀', '🥯', '🍎', '🍊', '🍋'],
    activities: ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️', '🥌', '🎿'],
    travel: ['✈️', '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝'],
    objects: ['💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '🪙', '💰', '💳', '💎', '⚖️', '🪜', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🪚', '🔩', '⚙️', '🪤', '🧱', '⛓️', '🧲', '🔫', '💣'],
    symbols: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈']
};

// Auto-resize textarea
const autoResizeTextarea = () => {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
};

// Create message elements with improved structure
const createMessageElement = (content, ...classes) => {
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
};

// Format file size
const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Get file icon based on file type
const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    const iconMap = {
        'pdf': 'bi-file-earmark-pdf',
        'doc': 'bi-file-earmark-word',
        'docx': 'bi-file-earmark-word',
        'txt': 'bi-file-earmark-text',
        'jpg': 'bi-file-earmark-image',
        'jpeg': 'bi-file-earmark-image',
        'png': 'bi-file-earmark-image',
        'gif': 'bi-file-earmark-image',
        'webp': 'bi-file-earmark-image'
    };
    return iconMap[extension] || 'bi-file-earmark';
};

// Show emoji picker
const showEmojiPicker = () => {
    emojiPicker.classList.toggle('show');
    filePreviewArea.classList.remove('show');
    emojiButton.classList.toggle('active');
    
    if (emojiPicker.classList.contains('show')) {
        loadEmojis('smileys');
    }
};

// Load emojis for selected category
const loadEmojis = (category) => {
    emojiGrid.innerHTML = '';
    const emojis = emojiData[category] || emojiData.smileys;
    
    emojis.forEach(emoji => {
        const button = document.createElement('button');
        button.className = 'emoji-item';
        button.textContent = emoji;
        button.addEventListener('click', () => insertEmoji(emoji));
        emojiGrid.appendChild(button);
    });
};

// Insert emoji into message input
const insertEmoji = (emoji) => {
    const cursorPos = messageInput.selectionStart;
    const textBefore = messageInput.value.substring(0, cursorPos);
    const textAfter = messageInput.value.substring(cursorPos);
    
    messageInput.value = textBefore + emoji + textAfter;
    messageInput.focus();
    messageInput.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    
    autoResizeTextarea();
    emojiPicker.classList.remove('show');
    emojiButton.classList.remove('active');
};

// Handle file selection
const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }
    
    userData.file = file;
    showFilePreview(file);
    emojiPicker.classList.remove('show');
    emojiButton.classList.remove('active');
};

// Show file preview
const showFilePreview = (file) => {
    const fileName = filePreviewArea.querySelector('.file-name');
    const fileSize = filePreviewArea.querySelector('.file-size');
    const fileIcon = filePreviewArea.querySelector('.file-info i');
    
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileIcon.className = `bi ${getFileIcon(file.name)}`;
    
    filePreviewArea.classList.add('show');
};

// Remove file
const removeFile = () => {
    userData.file = null;
    fileInput.value = '';
    filePreviewArea.classList.remove('show');
};

// Create file attachment element for message
const createFileAttachment = (file) => {
    if (file.type.startsWith('image/')) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(`
                    <div class="image-attachment">
                        <img src="${e.target.result}" alt="${file.name}" />
                    </div>
                `);
            };
            reader.readAsDataURL(file);
        });
    } else {
        return Promise.resolve(`
            <div class="file-attachment">
                <i class="bi ${getFileIcon(file.name)}"></i>
                <div class="file-info">
                    <span class="file-name">${file.name}</span>
                    <span class="file-size">${formatFileSize(file.size)}</span>
                </div>
            </div>
        `);
    }
};

// Enhanced bot response generation with file handling
const generateBotResponse = async (incomingMessageDiv) => {
    const messageElement = incomingMessageDiv.querySelector(".bot-msgs-text");
    
    let messageContent = userData.message;
    if (userData.file) {
        messageContent += `\n\n[User attached a file: ${userData.file.name}]`;
    }
    
    const requestOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: messageContent }]
            }]
        })
    };

    try {
        const response = await fetch(API_URL, requestOptions);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to get response');
        }

        const apiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        
        if (apiResponseText) {
            messageElement.innerHTML = '';
            await typeMessage(messageElement, apiResponseText);
            
            // Store bot response in chat history
            storeMessage('bot', apiResponseText);
        } else {
            throw new Error('No response received');
        }
        
    } catch (error) {
        console.error('Error:', error);
        const errorMessage = `Sorry, I'm having trouble connecting right now. Please try again in a moment.`;
        messageElement.innerHTML = `
            <p style="color: #ef4444;">
                <i class="bi bi-exclamation-triangle"></i> 
                ${errorMessage}
            </p>
        `;
        
        // Store error message in chat history
        storeMessage('bot', errorMessage);
    } finally {
        incomingMessageDiv.classList.remove("thinking");
        scrollToBottom();
    }
};

// Typing animation effect
const typeMessage = (element, text, speed = 30) => {
    return new Promise((resolve) => {
        let index = 0;
        const timer = setInterval(() => {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                scrollToBottom();
            } else {
                clearInterval(timer);
                resolve();
            }
        }, speed);
    });
};

// Smooth scroll to bottom
const scrollToBottom = () => {
    chatbotBody.scrollTo({
        top: chatbotBody.scrollHeight,
        behavior: "smooth"
    });
};

// Handle outgoing messages with file support
const handleOutGoingMsg = async (e) => {
    e.preventDefault();
    
    const message = messageInput.value.trim();
    if (!message && !userData.file) return;
    
    userData.message = message || "📎 File attached";
    const currentFile = userData.file;
    
    // Store user message in chat history
    storeMessage('user', userData.message, currentFile);
    
    // Clear inputs
    messageInput.value = "";
    messageInput.style.height = 'auto';
    removeFile();
    
    // Create user message content
    let messageContent = `<div class="enter-msgs-text">${userData.message}</div>`;
    
    // Add file attachment if present
    if (currentFile) {
        const fileAttachment = await createFileAttachment(currentFile);
        messageContent = `<div class="enter-msgs-text">${userData.message}${fileAttachment}</div>`;
    }
    
    messageContent += `<i id="user-logo" class="bi bi-person-circle"></i>`;
    
    const outgoingMessageDiv = createMessageElement(messageContent, "enter-msgs");
    chatbotBody.appendChild(outgoingMessageDiv);
    scrollToBottom();

    // Show bot thinking indicator
    setTimeout(() => {
        const botMessageContent = `
            <svg class="chatbot-logo" xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 1024 1024">
                <path d="M738.3 287.6H285.7c-59 0-106.8 47.8-106.8 106.8v303.1c0 59 47.8 106.8 106.8 106.8h81.5v111.1c0 .7.8 1.1 1.4.7l166.9-110.6 41.8-.8h117.4l43.6-.4c59 0 106.8-47.8 106.8-106.8V394.5c0-59-47.8-106.9-106.8-106.9zM351.7 448.2c0-29.5 23.9-53.5 53.5-53.5s53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5-53.5-23.9-53.5-53.5zm157.9 267.1c-67.8 0-123.8-47.5-132.3-109h264.6c-8.6 61.5-64.5 109-132.3 109zm110-213.7c-29.5 0-53.5-23.9-53.5-53.5s23.9-53.5 53.5-53.5 53.5 23.9 53.5 53.5-23.9 53.5-53.5 53.5zM867.2 644.5V453.1h26.5c19.4 0 35.1 15.7 35.1 35.1v121.1c0 19.4-15.7 35.1-35.1 35.1h-26.5zM95.2 609.4V488.2c0-19.4 15.7-35.1 35.1-35.1h26.5v191.3h-26.5c-19.4 0-35.1-15.7-35.1-35.1zM561.5 149.6c0 23.4-15.6 43.3-36.9 49.7v44.9h-30v-44.9c-21.4-6.5-36.9-26.3-36.9-49.7 0-28.6 23.3-51.9 51.9-51.9s51.9 23.3 51.9 51.9z"></path>
            </svg>
            <div class="bot-msgs-text">
                <div class="thinking-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        
        const incomingMessageDiv = createMessageElement(botMessageContent, "bot-msgs", "thinking");
        chatbotBody.appendChild(incomingMessageDiv);
        scrollToBottom();
        
        // Generate bot response
        generateBotResponse(incomingMessageDiv);
    }, 500);
};

// Close overlays when clicking outside
const closeOverlays = (e) => {
    if (!emojiPicker.contains(e.target) && !emojiButton.contains(e.target)) {
        emojiPicker.classList.remove('show');
        emojiButton.classList.remove('active');
    }
};

// Enhanced event listeners
messageInput.addEventListener("input", autoResizeTextarea);

messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const userMessage = e.target.value.trim();
        if (userMessage || userData.file) {
            handleOutGoingMsg(e);
        }
    }
});

chatForm.addEventListener("submit", handleOutGoingMsg);

// Emoji picker events
emojiButton.addEventListener("click", (e) => {
    e.stopPropagation();
    showEmojiPicker();
});

// Emoji category selection
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('emoji-category')) {
        // Remove active class from all categories
        document.querySelectorAll('.emoji-category').forEach(cat => cat.classList.remove('active'));
        // Add active class to clicked category
        e.target.classList.add('active');
        // Load emojis for selected category
        loadEmojis(e.target.dataset.category);
    }
});

// File upload events
fileButton.addEventListener("click", () => {
    fileInput.click();
    emojiPicker.classList.remove('show');
    emojiButton.classList.remove('active');
});

fileInput.addEventListener("change", handleFileSelect);
removeFileButton.addEventListener("click", removeFile);

// Firebase button event
firebaseButton.addEventListener("click", handleFirebaseConnection);

// Close overlays when clicking outside
document.addEventListener("click", closeOverlays);

// Close button functionality
closeButton.addEventListener("click", () => {
    const popup = document.querySelector(".chatbot-popup");
    popup.style.transform = "scale(0.8) translateY(20px)";
    popup.style.opacity = "0.7";
    
    setTimeout(() => {
        popup.style.transform = "scale(1) translateY(0)";
        popup.style.opacity = "1";
    }, 300);
});

// Global functions for external access
window.chatbotAPI = {
    getChatHistory,
    clearChatHistory,
    exportChatHistory,
    connectFirebase: initializeFirebase,
    disconnectFirebase,
    isFirebaseConnected: () => isFirebaseConnected
};

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + E to export chat history
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        exportChatHistory();
        showNotification('📥 Chat history exported!', 'success');
    }
    
    // Ctrl/Cmd + Shift + C to clear chat history
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        if (confirm('Are you sure you want to clear the chat history? This action cannot be undone.')) {
            clearChatHistory();
            showNotification('🗑️ Chat history cleared!', 'info');
        }
    }
});

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    messageInput.focus();
    scrollToBottom();
    
    // Store initial bot message
    storeMessage('bot', "👋 Hey there!\nI'm ShiftAI, your intelligent assistant. How can I help you today?");
    
    console.log('Chatbot initialized with storage capabilities');
    console.log('Available commands:');
    console.log('- Ctrl/Cmd + E: Export chat history');
    console.log('- Ctrl/Cmd + Shift + C: Clear chat history');
    console.log('- Access chatbotAPI from console for programmatic control');
});

// Handle window resize
window.addEventListener("resize", () => {
    scrollToBottom();
});

// Auto-save chat history to localStorage as backup
setInterval(() => {
    try {
        localStorage.setItem('chatbot_backup', JSON.stringify(chatHistory));
    } catch (error) {
        console.warn('Failed to backup chat to localStorage:', error);
    }
}, 30000); // Backup every 30 seconds

// Load backup on page load
try {
    const backup = localStorage.getItem('chatbot_backup');
    if (backup) {
        const backupData = JSON.parse(backup);
        // Only restore if it's from the same session or recent
        const backupTime = new Date(backupData.startTime);
        const now = new Date();
        const hoursDiff = (now - backupTime) / (1000 * 60 * 60);
        
        if (hoursDiff < 24) { // Restore if less than 24 hours old
            chatHistory = backupData;
            console.log('Chat history restored from backup');
        }
    }
} catch (error) {
    console.warn('Failed to restore chat backup:', error);
}