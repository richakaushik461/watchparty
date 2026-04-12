import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { UserRole } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  playState: boolean;
  onStateChange?: (state: number) => void;
  onTimeUpdate?: (time: number) => void;
  onReady?: () => void;
  userRole?: UserRole;
  isSyncing?: boolean;
}

export const YouTubePlayer = forwardRef<any, YouTubePlayerProps>(({
  videoId,
  playState,
  onStateChange,
  onTimeUpdate,
  onReady,
  userRole,
  isSyncing = false,
}, ref) => {
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const timeUpdateInterval = useRef<ReturnType<typeof setInterval>>();
  const [playerReady, setPlayerReady] = useState(false);
  const [internalVideoId, setInternalVideoId] = useState(videoId);

  const canControl = userRole === 'host' || userRole === 'moderator';

  // Expose player methods to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentTime: () => {
      return playerRef.current?.getCurrentTime() || 0;
    },
    seekTo: (time: number) => {
      if (playerRef.current) {
        playerRef.current.seekTo(time, true);
      }
    },
    getPlayerState: () => {
      return playerRef.current?.getPlayerState() || -1;
    },
    playVideo: () => {
      playerRef.current?.playVideo();
    },
    pauseVideo: () => {
      playerRef.current?.pauseVideo();
    },
    loadVideoById: (videoId: string) => {
      playerRef.current?.loadVideoById(videoId);
    }
  }));

  // Initialize YouTube Player
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        initializePlayer();
      };
    } else {
      initializePlayer();
    }

    return () => {
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
      if (playerRef.current) {
        playerRef.current.destroy();
      }
    };
  }, []);

  const initializePlayer = () => {
    if (!playerContainerRef.current) return;

    playerRef.current = new window.YT.Player(playerContainerRef.current, {
      videoId: internalVideoId,
      playerVars: {
        controls: canControl ? 1 : 0,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
        iv_load_policy: 3,
        disablekb: canControl ? 0 : 1,
        fs: canControl ? 1 : 0,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          onReady?.();
          
          timeUpdateInterval.current = setInterval(() => {
            if (playerRef.current?.getCurrentTime) {
              const currentTime = playerRef.current.getCurrentTime();
              onTimeUpdate?.(currentTime);
            }
          }, 500);
        },
        onStateChange: (event: any) => {
          if (!isSyncing) {
            onStateChange?.(event.data);
          }
        },
      },
    });
  };

  // Handle video ID changes
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    
    if (videoId !== internalVideoId) {
      setInternalVideoId(videoId);
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId, playerReady]);

  // Handle play/pause state changes from server
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    const currentState = playerRef.current.getPlayerState();
    
    if (playState && currentState !== 1) {
      playerRef.current.playVideo();
    } else if (!playState && currentState === 1) {
      playerRef.current.pauseVideo();
    }
  }, [playState, playerReady]);

  return (
    <div className="youtube-container relative">
      <div ref={playerContainerRef} className="absolute inset-0" />
      
      {/* Overlay for participants to prevent interaction */}
      {!canControl && (
        <div className="absolute inset-0 bg-transparent z-10 cursor-default" />
      )}
      
      {/* View-only mode indicator */}
      {!canControl && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-white text-sm font-medium">
          👁️ View-only mode
        </div>
      )}
    </div>
  );
});