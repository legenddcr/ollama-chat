from flask import Flask, render_template, request, jsonify
import requests

app = Flask(__name__)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        message = data.get('message')
        
        # 与本地Ollama API通信
        response = requests.post('http://localhost:11434/api/generate', 
            json={
                "model": "qwen2.5-coder",  # 可以根据需要更改模型
                "prompt": message,
                "stream": False
            })
        
        if response.status_code == 200:
            return jsonify({
                'response': response.json()['response'],
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

if __name__ == '__main__':
    app.run(debug=True) 