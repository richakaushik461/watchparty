export type UserRole = 'host' | 'moderator' | 'participant' | 'viewer';

export interface Participant {
  id: string;
  username: string;
  role: UserRole;
  joinedAt?: number;
}

export interface VideoState {
  videoId: string;
  playState: boolean;
  currentTime: number;
}

export interface RoomState {
  roomId: string;
  participants: Participant[];
  currentVideo: VideoState;
  currentUserRole?: UserRole;
}

export interface ChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}