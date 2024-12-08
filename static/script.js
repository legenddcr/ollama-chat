document.addEventListener('DOMContentLoaded', () => {
    // 配置marked选项
    marked.setOptions({
        highlight: function(code, language) {
            if (language && hljs.getLanguage(language)) {
                try {
                    return hljs.highlight(code, { language }).value;
                } catch (err) {
                    console.error('Highlight error:', err);
                }
            }
            try {
                return hljs.highlightAuto(code).value;
            } catch (err) {
                console.error('Highlight error:', err);
                return code;
            }
        },
        breaks: true,
        gfm: true,
        headerIds: true,
        mangle: false
    });

    // 初始化highlight.js
    hljs.configure({
        ignoreUnescapedHTML: true
    });

    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const newChatButton = document.getElementById('newChatButton');
    const conversationsList = document.getElementById('conversationsList');

    let currentConversationId = null;

    // 加载会话列表
    async function loadConversations() {
        try {
            const response = await fetch('/conversations');
            const data = await response.json();
            conversationsList.innerHTML = '';
            
            data.conversations.forEach(conversation => {
                const div = document.createElement('div');
                div.className = `conversation-item ${conversation.id === currentConversationId ? 'active' : ''}`;
                div.textContent = conversation.title;
                div.onclick = () => loadConversation(conversation.id);
                conversationsList.appendChild(div);
            });
        } catch (error) {
            console.error('加载会话列表失败:', error);
        }
    }

    // 加载特定会话
    async function loadConversation(conversationId) {
        try {
            const response = await fetch(`/conversations/${conversationId}`);
            const conversation = await response.json();
            
            currentConversationId = conversation.id;
            chatMessages.innerHTML = '';
            
            // 显示会话消息历史
            conversation.messages.forEach(message => {
                addMessage(message.content, message.role === 'user');
            });
            
            // 更新会话列表中的活动状态
            document.querySelectorAll('.conversation-item').forEach(item => {
                item.classList.remove('active');
                if (item.textContent === conversation.title) {
                    item.classList.add('active');
                }
            });
        } catch (error) {
            console.error('加载会话失败:', error);
        }
    }

    // 创建新会话
    async function createNewConversation() {
        try {
            const response = await fetch('/conversations/new', {
                method: 'POST'
            });
            const conversation = await response.json();
            currentConversationId = conversation.id;
            chatMessages.innerHTML = '';
            loadConversations();
        } catch (error) {
            console.error('创建新会话失败:', error);
        }
    }

    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;
        
        if (isUser) {
            // 用户消息使用纯文本
            const textNode = document.createTextNode(message);
            messageDiv.appendChild(textNode);
        } else {
            try {
                // AI响应需要Markdown渲染
                messageDiv.innerHTML = marked.parse(message);
                
                // 处理代码块的复制功能
                messageDiv.querySelectorAll('pre code').forEach((block) => {
                    const copyButton = document.createElement('button');
                    copyButton.className = 'copy-button';
                    copyButton.textContent = '复制';
                    block.parentNode.insertBefore(copyButton, block);

                    copyButton.addEventListener('click', async () => {
                        try {
                            await navigator.clipboard.writeText(block.textContent);
                            copyButton.textContent = '已复制!';
                            setTimeout(() => {
                                copyButton.textContent = '复制';
                            }, 2000);
                        } catch (err) {
                            console.error('复制失败:', err);
                        }
                    });
                });
            } catch (err) {
                console.error('Markdown解析错误:', err);
                messageDiv.textContent = message;
            }
        }
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        addMessage(message, true);
        messageInput.value = '';

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            const data = await response.json();
            
            if (data.success) {
                addMessage(data.response);
            } else {
                addMessage('错误: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            addMessage('发送消息时出错: ' + error.message);
        }
    }

    // 事件监听器
    sendButton.addEventListener('click', sendMessage);
    newChatButton.addEventListener('click', createNewConversation);

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 初始加载会话列表
    loadConversations();
}); 