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
    const clearChatButton = document.getElementById('clearChatButton');

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
                addMessage(message.content, message.role === 'user', message.role === 'assistant' ? message.model : null);
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

    function addMessage(message, isUser = false, modelName = null) {
        const containerDiv = document.createElement('div');
        containerDiv.className = `message-container ${isUser ? 'user-message-container' : 'bot-message-container'}`;

        if (!isUser && modelName) {
            const labelDiv = document.createElement('div');
            labelDiv.className = 'model-label';
            labelDiv.textContent = modelName;
            containerDiv.appendChild(labelDiv);
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        if (isUser) {
            const textNode = document.createTextNode(message);
            messageDiv.appendChild(textNode);
        } else {
            try {
                messageDiv.innerHTML = marked.parse(message);
                
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

        containerDiv.appendChild(messageDiv);
        chatMessages.appendChild(containerDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    async function sendMessage() {
        const message = messageInput.value.trim();
        if (!message) return;

        // 清空输入框并添加用户消息
        messageInput.value = '';
        addMessage(message, true);

        // 创建一个消息容器用于流式输出
        const containerDiv = document.createElement('div');
        containerDiv.className = 'message-container bot-message-container';
        
        // 添加模型标签
        const labelDiv = document.createElement('div');
        labelDiv.className = 'model-label';
        labelDiv.textContent = 'Qwen2.5-Coder';
        containerDiv.appendChild(labelDiv);

        // 创建消息div
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';
        containerDiv.appendChild(messageDiv);
        chatMessages.appendChild(containerDiv);

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            fullResponse += data.chunk;
                            
                            // 使用marked实时渲染Markdown
                            messageDiv.innerHTML = marked.parse(fullResponse);
                            
                            // 添加代码块的复制按钮
                            messageDiv.querySelectorAll('pre code').forEach((block) => {
                                if (!block.parentNode.querySelector('.copy-button')) {
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
                                }
                            });

                            // 滚动到底部
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } catch (e) {
                            console.error('解析响应数据失败:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('发送消息失败:', error);
            messageDiv.textContent = '发送消息时出错: ' + error.message;
        }

        // 滚动到底部
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // 添加清除会话功能
    async function clearCurrentChat() {
        if (!currentConversationId) {
            console.error('No active conversation');
            return;
        }

        try {
            const response = await fetch(`/conversations/${currentConversationId}/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success) {
                // 清空聊天界面
                chatMessages.innerHTML = '';
                // 更新会话列表
                await loadConversations();
                // 可选：显示成功提示
                console.log('Chat cleared successfully');
            } else {
                throw new Error(data.error || '清除失败');
            }
        } catch (error) {
            console.error('清除会话失败:', error);
            // 显示错误消息
            addMessage('清除会话失败: ' + error.message, false);
        }
    }

    // 事件监听器
    sendButton.addEventListener('click', sendMessage);
    newChatButton.addEventListener('click', createNewConversation);
    clearChatButton.addEventListener('click', async (e) => {
        e.preventDefault(); // 防止表单提交
        if (confirm('确定要清除当前会话的所有消息吗？')) {
            await clearCurrentChat();
        }
    });

    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 初始加载会话列表
    loadConversations();
}); 