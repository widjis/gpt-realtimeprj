# GPT Realtime Project (MARISA)

A real-time conversational AI application with advanced memory management and multimodal capabilities.

## 🚀 Features

### Core Functionality
- **Real-time Voice Conversation**: Seamless voice interaction using OpenAI's Realtime API
- **5-Context Memory System**: Intelligent conversation context management with persistent storage
- **MCP Integration**: Model Context Protocol support for extended functionality
- **Responsive UI**: Modern React interface with TailwindCSS styling

### Advanced Capabilities
- **Cross-session Memory**: Conversations persist across browser sessions
- **Context Window Management**: Automatic handling of conversation context limits
- **Environment Configuration**: Secure credential management
- **Real-time Updates**: Live conversation state synchronization

## 🏗️ Architecture

### Frontend (`/web`)
- **Framework**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS with Shadcn UI components
- **State Management**: React hooks with localStorage persistence
- **Real-time Communication**: WebSocket integration

### Backend (`/server`)
- **Runtime**: Node.js + Express
- **API Integration**: OpenAI Realtime API
- **MCP Support**: Model Context Protocol server integration
- **Environment**: Secure configuration management

## 📋 Prerequisites

- Node.js 18+ and npm
- OpenAI API key with Realtime API access
- Git for version control

## 🛠️ Installation

### 1. Clone the Repository
```bash
git clone https://github.com/widjis/gpt-realtimeprj.git
cd gpt-realtimeprj
```

### 2. Backend Setup
```bash
cd server
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your OpenAI API key and MCP server URL
```

### 3. Frontend Setup
```bash
cd ../web
npm install
```

## ⚙️ Configuration

Create `server/.env` file with:
```env
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
MCP_SERVER_URL=https://your-mcp-server.com/mcp/server
NODE_TLS_REJECT_UNAUTHORIZED=0
```

## 🚀 Running the Application

### Development Mode

1. **Start the Backend Server**:
```bash
cd server
node index.js
```

2. **Start the Frontend Development Server**:
```bash
cd web
npm run dev
```

3. **Access the Application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001

## 🎯 Usage

1. **Start Conversation**: Click the microphone button to begin voice interaction
2. **Memory Management**: The system automatically manages conversation context
3. **Session Persistence**: Your conversation history is saved across browser sessions
4. **Real-time Responses**: Experience seamless voice-to-voice communication

## 📁 Project Structure

```
gpt-realtimeprj/
├── docs/
│   └── journal.md          # Development journal and changelog
├── server/
│   ├── .env.example        # Environment configuration template
│   ├── index.js           # Main server application
│   ├── package.json       # Backend dependencies
│   └── package-lock.json
├── web/
│   ├── src/
│   │   ├── App.tsx        # Main React application
│   │   ├── App.css        # Application styles
│   │   └── main.tsx       # Application entry point
│   ├── package.json       # Frontend dependencies
│   ├── tailwind.config.js # TailwindCSS configuration
│   └── vite.config.ts     # Vite build configuration
├── .gitignore             # Git ignore rules
└── README.md              # This file
```

## 🔧 Development

### Key Components

- **Memory System**: 5-context conversation management with localStorage
- **WebSocket Handler**: Real-time communication with OpenAI API
- **MCP Integration**: Extended functionality through Model Context Protocol
- **UI Components**: Modern React components with TailwindCSS

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for Realtime API | Yes |
| `PORT` | Backend server port | No (default: 3001) |
| `MCP_SERVER_URL` | MCP server endpoint | Yes |
| `NODE_TLS_REJECT_UNAUTHORIZED` | TLS certificate validation | No |

## 🚧 Roadmap

- [ ] **Multimodal Screen Sharing**: Add screen capture and vision capabilities
- [ ] **Advanced Context Management**: Enhanced memory algorithms
- [ ] **User Authentication**: Secure user sessions
- [ ] **Mobile App**: React Native implementation
- [ ] **Cloud Deployment**: Production deployment guides

## 📝 Documentation

Detailed development logs and feature implementations are documented in [`docs/journal.md`](docs/journal.md).

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- OpenAI for the Realtime API
- React and Vite communities
- TailwindCSS for the styling framework
- Model Context Protocol for extensibility

---

**Built with ❤️ using React, Node.js, and OpenAI Realtime API**