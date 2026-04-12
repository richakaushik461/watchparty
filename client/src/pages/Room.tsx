import { useState, useEffect, useRef } { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { YouTubePlayer } from '../components/YouTubePlayer';
import { ParticipantList } from '../components/ParticipantList';
import { Chat } from '../components/Chat';
import { VideoState, UserRole, RoomState, ChatMessage } from '../types';
import { Play, Pause, SkipBack, SkipForward, Link2, Copy, Check, LogOut, Crown, Users, MessageCircle, Shield } from 'lucide-react';

export const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();

  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [username] = useState(searchParams.get('username') || 'Guest');
  const [videoUrl, setVideoUrl] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'participants' | 'chat'>('participants');

  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const playerRef = useRef<any>(null);

  const currentUserRole = roomState?.currentUserRole;
  const canControl = currentUserRole === 'host' || currentUserRole === 'moderator';
  const isHost = currentUserRole === 'host';

  useEffect(() => {
    if (!socket || !isConnected) return;

    if (roomId === 'create') {
      socket.emit('create_room', { username });
    } else {
      socket.emit('join_room', { roomId, username });
    }

    socket.on('room_created', (data: any) => {
      setRoomState({
        roomId: data.roomId,
        participants: data.participants,
        currentVideo: data.currentVideo,
        currentUserRole: 'host',
      });
      setMessages(data.chatHistory || []);
      navigate(`/room/${data.roomId}?username=${username}`, { replace: true });
    });

    socket.on('room_joined', (data: any) => {
      setRoomState({
        roomId: data.roomId,
        participants: data.participants,
        currentVideo: data.currentVideo,
        currentUserRole: data.role,
      });
      setMessages(data.chatHistory || []);
    });

    socket.on('sync_state', (videoState: VideoState) => {
      setIsSyncing(true);
      setRoomState(prev => prev ? { ...prev, currentVideo: videoState } : null);
      
      // Apply to player
      if (playerRef.current) {
        const currentTime = playerRef.current.getCurrentTime();
        const playerState = playerRef.current.getPlayerState();
        
        // Handle play/pause
        if (videoState.playState && playerState !== 1) {
          playerRef.current.playVideo();
        } else if (!videoState.playState && playerState === 1) {
          playerRef.current.pauseVideo();
        }
        
        // Handle seek
        if (Math.abs(currentTime - videoState.currentTime) > 1) {
          playerRef.current.seekTo(videoState.currentTime);
        }
      }
      
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 500);
    });

    socket.on('user_joined', (data: any) => {
      setRoomState(prev => prev ? { ...prev, participants: data.participants } : null);
    });

    socket.on('user_left', (data: any) => {
      setRoomState(prev => prev ? { ...prev, participants: data.participants } : null);
    });

    socket.on('role_assigned', (data: any) => {
      setRoomState(prev => {
        if (!prev) return null;
        const currentParticipant = data.participants.find((p: any) => p.id === socket.id);
        const newRole = currentParticipant?.role || prev.currentUserRole;
        return {
          ...prev,
          participants: data.participants,
          currentUserRole: newRole as UserRole,
        };
      });
    });

    socket.on('your_role_updated', (data: any) => {
      setRoomState(prev => {
        if (!prev) return null;
        return { ...prev, currentUserRole: data.role as UserRole };
      });
    });

    socket.on('participant_removed', (data: any) => {
      setRoomState(prev => prev ? { ...prev, participants: data.participants } : null);
    });

    socket.on('host_transferred', (data: any) => {
      setRoomState(prev => {
        if (!prev) return null;
        const newRole = data.newHostId === socket.id ? 'host' as UserRole : 
                       prev.currentUserRole === 'host' ? 'participant' as UserRole : prev.currentUserRole;
        return {
          ...prev,
          participants: data.participants,
          currentUserRole: newRole,
        };
      });
    });

    socket.on('new_message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
    });

    socket.on('kicked', () => {
      navigate('/');
    });

    socket.on('error', (data: any) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    });

    return () => {
      socket.off('room_created');
      socket.off('room_joined');
      socket.off('sync_state');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('role_assigned');
      socket.off('your_role_updated');
      socket.off('participant_removed');
      socket.off('host_transferred');
      socket.off('new_message');
      socket.off('kicked');
      socket.off('error');
      
      if (roomState?.roomId) {
        socket.emit('leave_room', { roomId: roomState.roomId });
      }
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [socket, isConnected, roomId, username, navigate]);

  // SIMPLE CONTROLS - Direct socket emit
  const handlePlay = () => {
    console.log('Play clicked - canControl:', canControl, 'roomState:', !!roomState);
    if (!canControl || !roomState) return;
    socket?.emit('play', { roomId: roomState.roomId });
  };

  const handlePause = () => {
    console.log('Pause clicked - canControl:', canControl, 'roomState:', !!roomState);
    if (!canControl || !roomState) return;
    socket?.emit('pause', { roomId: roomState.roomId });
  };

  const handleSeek = (time: number) => {
    console.log('Seek clicked - time:', time);
    if (!canControl || !roomState) return;
    socket?.emit('seek', { roomId: roomState.roomId, time });
  };

  const handleVideoStateChange = (state: number) => {
    if (!canControl || !roomState) return;
    
    // YT.PlayerState: 1 = playing, 2 = paused
    if (state === 1) {
      socket?.emit('play', { roomId: roomState.roomId });
    } else if (state === 2) {
      socket?.emit('pause', { roomId: roomState.roomId });
    }
  };

  const extractVideoId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\s?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };

  const handleChangeVideo = () => {
    if (!canControl || !roomState) return;
    
    const videoId = extractVideoId(videoUrl);
    if (videoId) {
      socket?.emit('change_video', { roomId: roomState.roomId, videoId });
      setVideoUrl('');
    } else {
      setError('Invalid YouTube URL');
      setTimeout(() => setError(''), 3000);
    }
  };

  const handleAssignRole = (userId: string, role: UserRole) => {
    if (!roomState || !isHost) return;
    socket?.emit('assign_role', { roomId: roomState.roomId, userId, role });
  };

  const handleRemoveParticipant = (userId: string) => {
    if (!roomState || !isHost) return;
    socket?.emit('remove_participant', { roomId: roomState.roomId, userId });
  };

  const handleTransferHost = (userId: string) => {
    if (!roomState || !isHost) return;
    socket?.emit('transfer_host', { roomId: roomState.roomId, newHostId: userId });
  };

  const handleSendMessage = (message: string) => {
    if (!roomState || !socket) return;
    socket.emit('send_message', {
      roomId: roomState.roomId,
      message: message,
    });
  };

  const handleLeaveRoom = () => {
    if (roomState) {
      socket?.emit('leave_room', { roomId: roomState.roomId });
    }
    navigate('/');
  };

  const copyRoomLink = () => {
    if (!roomState) return;
    const url = `${window.location.origin}/room/${roomState.roomId}`;
    navigator.clipboard.writeText(url);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const copyRoomCode = () => {
    if (!roomState) return;
    navigator.clipboard.writeText(roomState.roomId);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  if (!roomState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-blue-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Connecting to room...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <header className="sticky top-0 z-30 glass-effect border-b border-white/30 px-4 md:px-6 py-3">
        <div className="max-w-[1920px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Watch Party
            </h1>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">Room:</span>
              <button
                onClick={copyRoomCode}
                className="px-3 py-1.5 bg-white/80 rounded-full text-sm font-mono font-medium hover:bg-white transition-all flex items-center gap-2 shadow-sm"
              >
                {roomState.roomId}
                {showCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            {isHost && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-100/80 rounded-full">
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Host</span>
              </div>
            )}
            {currentUserRole === 'moderator' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100/80 rounded-full">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium text-blue-700">Moderator</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={copyRoomLink} className="apple-button flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Copy Link</span>
            </button>
            <button onClick={handleLeaveRoom} className="apple-button-danger flex items-center gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1920px] mx-auto px-4 md:px-6 py-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50/90 backdrop-blur-sm border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-[1fr,380px] gap-6">
          <div className="space-y-4">
            <div className="apple-card overflow-hidden">
              <div className="p-3">
                <YouTubePlayer
                  ref={playerRef}
                  videoId={roomState.currentVideo.videoId}
                  playState={roomState.currentVideo.playState}
                  onStateChange={handleVideoStateChange}
                  onTimeUpdate={handleSeek}
                  userRole={currentUserRole}
                  isSyncing={isSyncing}
                />
              </div>
            </div>

            {canControl && (
              <div className="apple-card p-5">
                <div className="flex items-center justify-center gap-4 mb-4">
                  <button
                    onClick={handlePause}
                    className="apple-button w-14 h-14 rounded-full flex items-center justify-center p-0"
                  >
                    <Pause className="w-6 h-6" />
                  </button>
                  <button
                    onClick={handlePlay}
                    className="apple-button-primary w-16 h-16 rounded-full flex items-center justify-center p-0"
                  >
                    <Play className="w-7 h-7" />
                  </button>
                  <button
                    onClick={() => handleSeek(Math.max(0, roomState.currentVideo.currentTime - 10))}
                    className="apple-button w-14 h-14 rounded-full flex items-center justify-center p-0"
                  >
                    <SkipBack className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => handleSeek(roomState.currentVideo.currentTime + 10)}
                    className="apple-button w-14 h-14 rounded-full flex items-center justify-center p-0"
                  >
                    <SkipForward className="w-6 h-6" />
                  </button>
                </div>

                <div className="flex gap-3">
                  <input
                    type="text"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="Paste YouTube URL or Video ID"
                    className="apple-input flex-1"
                    onKeyPress={(e) => e.key === 'Enter' && handleChangeVideo()}
                  />
                  <button onClick={handleChangeVideo} className="apple-button-primary whitespace-nowrap px-6">
                    Change Video
                  </button>
                </div>
              </div>
            )}

            <div className="apple-card p-5">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Now Playing</p>
                  <p className="text-sm text-gray-700 break-all">
                    youtube.com/watch?v={roomState.currentVideo.videoId}
                  </p>
                </div>
                <div className="sm:border-l sm:border-gray-200 sm:pl-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Room Info</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status</span>
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-gray-900">{isConnected ? 'Connected' : 'Reconnecting...'}</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Your Role</span>
                      <span className="font-medium text-gray-900">
                        {currentUserRole ? currentUserRole.charAt(0).toUpperCase() + currentUserRole.slice(1) : 'Guest'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Participants</span>
                      <span className="font-medium text-gray-900">{roomState.participants.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="lg:hidden flex gap-2 p-1 bg-gray-100 rounded-full">
              <button
                onClick={() => setActiveTab('participants')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'participants' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Participants ({roomState.participants.length})
              </button>
              <button
                onClick={() => setActiveTab('chat')}
                className={`flex-1 py-2 px-4 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'chat' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <MessageCircle className="w-4 h-4" />
                Chat ({messages.length})
              </button>
            </div>

            <div className={`${activeTab === 'participants' ? 'block' : 'hidden'} lg:block`}>
              <ParticipantList
                participants={roomState.participants}
                currentUserId={socket?.id}
                userRole={currentUserRole}
                onAssignRole={handleAssignRole}
                onRemoveParticipant={handleRemoveParticipant}
                onTransferHost={handleTransferHost}
              />
            </div>

            <div className={`${activeTab === 'chat' ? 'block' : 'hidden'} lg:block`}>
              <Chat
                messages={messages}
                onSendMessage={handleSendMessage}
                currentUserId={socket?.id}
                isConnected={isConnected}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
