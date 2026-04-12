import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Play, Sparkles, Shield } from 'lucide-react';

export const Home: React.FC = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [error, setError] = useState('');

  const handleCreateRoom = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    navigate(`/room/create?username=${encodeURIComponent(username)}`);
  };

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code');
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_SERVER_URL || 'http://localhost:3001'}/api/rooms/${roomCode}`);
      const data = await response.json();
      
      if (data.exists) {
        navigate(`/room/${roomCode}?username=${encodeURIComponent(username)}`);
      } else {
        setError('Room not found');
      }
    } catch (err) {
      setError('Failed to check room');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-apple-gray-50 via-white to-blue-50">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-apple-blue/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-apple-blue to-purple-500 shadow-lg mb-4">
            <Play className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-apple-gray-900 tracking-tight">
            Watch Party
          </h1>
          <p className="mt-2 text-apple-gray-600 text-[17px]">
            Watch YouTube together, perfectly synchronized
          </p>
        </div>

        <div className="apple-card p-6">
          <div className="flex gap-2 p-1 bg-apple-gray-100 rounded-full mb-6">
            <button
              onClick={() => setMode('create')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                mode === 'create'
                  ? 'bg-white text-apple-gray-900 shadow-sm'
                  : 'text-apple-gray-600 hover:text-apple-gray-900'
              }`}
            >
              Create Room
            </button>
            <button
              onClick={() => setMode('join')}
              className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all ${
                mode === 'join'
                  ? 'bg-white text-apple-gray-900 shadow-sm'
                  : 'text-apple-gray-600 hover:text-apple-gray-900'
              }`}
            >
              Join Room
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-apple-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your name"
                className="apple-input"
                onKeyPress={(e) => e.key === 'Enter' && (mode === 'create' ? handleCreateRoom() : handleJoinRoom())}
              />
            </div>

            {mode === 'join' && (
              <div>
                <label className="block text-sm font-medium text-apple-gray-700 mb-2">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 8-digit code"
                  className="apple-input uppercase"
                  maxLength={8}
                  onKeyPress={(e) => e.key === 'Enter' && handleJoinRoom()}
                />
              </div>
            )}

            {error && (
              <div className="text-apple-red text-sm text-center bg-red-50 py-2 px-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              onClick={mode === 'create' ? handleCreateRoom : handleJoinRoom}
              className="apple-button-primary w-full py-3 text-[17px]"
            >
              {mode === 'create' ? 'Create New Room' : 'Join Room'}
            </button>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-apple-blue/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-apple-blue" />
            </div>
            <p className="text-xs text-apple-gray-600">Real-time sync</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-purple-500/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-xs text-apple-gray-600">Role control</p>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-xs text-apple-gray-600">No sign-up</p>
          </div>
        </div>
      </div>
    </div>
  );
};
