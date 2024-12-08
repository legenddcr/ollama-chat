from flask import Flask, render_template, request, jsonify, session
import requests
from datetime import datetime
import uuid

app = Flask(__name__)
app.secret_key = 'your_secret_key'  # 设置session密钥

# 用于存储所有会话的字典
conversations = {}

@app.route('/')
def home():
    if 'current_conversation_id' not in session:
        # 创建新会话
        new_conversation_id = str(uuid.uuid4())
        conversations[new_conversation_id] = {
            'id': new_conversation_id,
            'title': f'新对话 {datetime.now().strftime("%Y-%m-%d %H:%M")}',
            'messages': [],
            'created_at': datetime.now().isoformat()
        }
        session['current_conversation_id'] = new_conversation_id
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message')
        conversation_id = session.get('current_conversation_id')
        
        if not conversation_id or conversation_id not in conversations:
            return jsonify({
                'error': '会话不存在',
                'success': False
            })

        # 保存用户消息
        conversations[conversation_id]['messages'].append({
            'role': 'user',
            'content': message,
            'timestamp': datetime.now().isoformat()
        })
        
        # 与Ollama API通信
        response = requests.post('http://localhost:11434/api/generate', 
            json={
                "model": "qwen2.5-coder",
                "prompt": message,
                "stream": False
            })
        
        if response.status_code == 200:
            ai_response = response.json()['response']
            # 保存AI响应
            conversations[conversation_id]['messages'].append({
                'role': 'assistant',
                'content': ai_response,
                'timestamp': datetime.now().isoformat()
            })
            return jsonify({
                'response': ai_response,
                'success': True
            })
        else:
            return jsonify({
                'error': '无法获取响应',
                'success': False
            })
            
    except Exception as e:
        return jsonify({
            'error': str(e),
            'success': False
        })

@app.route('/conversations', methods=['GET'])
def get_conversations():
    return jsonify({
        'conversations': sorted(
            conversations.values(),
            key=lambda x: x['created_at'],
            reverse=True
        )
    })

@app.route('/conversations/new', methods=['POST'])
def new_conversation():
    new_conversation_id = str(uuid.uuid4())
    conversations[new_conversation_id] = {
        'id': new_conversation_id,
        'title': f'新对话 {datetime.now().strftime("%Y-%m-%d %H:%M")}',
        'messages': [],
        'created_at': datetime.now().isoformat()
    }
    session['current_conversation_id'] = new_conversation_id
    return jsonify(conversations[new_conversation_id])

@app.route('/conversations/<conversation_id>', methods=['GET'])
def get_conversation(conversation_id):
    if conversation_id in conversations:
        session['current_conversation_id'] = conversation_id
        return jsonify(conversations[conversation_id])
    return jsonify({'error': '会话不存在'}), 404

if __name__ == '__main__':
    app.run(debug=True) 