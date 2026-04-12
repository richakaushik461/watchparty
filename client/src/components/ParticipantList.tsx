import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Participant, UserRole } from '../types';
import { Crown, Shield, User, MoreVertical } from 'lucide-react';

interface ParticipantListProps {
  participants: Participant[];
  currentUserId?: string;
  userRole?: UserRole;
  onAssignRole?: (userId: string, role: UserRole) => void;
  onRemoveParticipant?: (userId: string) => void;
  onTransferHost?: (userId: string) => void;
}

const RoleIcon: React.FC<{ role: UserRole }> = ({ role }) => {
  switch (role) {
    case 'host':
      return <Crown className="w-4 h-4 text-amber-500" />;
    case 'moderator':
      return <Shield className="w-4 h-4 text-blue-500" />;
    default:
      return <User className="w-4 h-4 text-gray-500" />;
  }
};

const RoleBadge: React.FC<{ role: UserRole }> = ({ role }) => {
  const styles = {
    host: 'bg-amber-50 text-amber-700 border-amber-200',
    moderator: 'bg-blue-50 text-blue-700 border-blue-200',
    participant: 'bg-gray-50 text-gray-600 border-gray-200',
    viewer: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[role]}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
};

// Dropdown Menu Component (rendered via Portal)
const ParticipantMenu: React.FC<{
  participant: Participant;
  onClose: () => void;
  onAction: (userId: string, action: string) => void;
  buttonRef: React.RefObject<HTMLButtonElement>;
}> = ({ participant, onClose, onAction, buttonRef }) => {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  React.useEffect(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.right - 180,
      });
    }
  }, [buttonRef]);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      <div
        className="fixed z-50 min-w-[180px] bg-white rounded-xl shadow-xl border border-gray-200 py-1 animate-fade-in"
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {participant.role === 'moderator' ? (
          <button
            onClick={() => onAction(participant.id, 'participant')}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Demote to Participant
          </button>
        ) : (
          <button
            onClick={() => onAction(participant.id, 'moderator')}
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Promote to Moderator
          </button>
        )}
        <button
          onClick={() => onAction(participant.id, 'transfer')}
          className="w-full px-4 py-2.5 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors"
        >
          Transfer Host
        </button>
        <hr className="my-1 border-gray-200" />
        <button
          onClick={() => onAction(participant.id, 'remove')}
          className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          Remove from Room
        </button>
      </div>
    </>,
    document.body
  );
};

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  userRole,
  onAssignRole,
  onRemoveParticipant,
  onTransferHost,
}) => {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const buttonRefs = React.useRef<Map<string, HTMLButtonElement>>(new Map());

  const isHost = userRole === 'host';

  const handleAction = (userId: string, action: string) => {
    setOpenMenuId(null);
    switch (action) {
      case 'moderator':
        onAssignRole?.(userId, 'moderator');
        break;
      case 'participant':
        onAssignRole?.(userId, 'participant');
        break;
      case 'remove':
        onRemoveParticipant?.(userId);
        break;
      case 'transfer':
        onTransferHost?.(userId);
        break;
    }
  };

  const openParticipant = participants.find(p => p.id === openMenuId);
  const menuButtonRef = openMenuId ? buttonRefs.current.get(openMenuId) : null;

  return (
    <div className="apple-card p-5 flex flex-col h-[400px]">
      {/* Fixed Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-semibold text-[17px] text-gray-900">
          Participants
          <span className="ml-2 text-sm font-normal text-gray-500">
            {participants.length}
          </span>
        </h3>
      </div>

      {/* Scrollable Participant List - Fixed Height with Overflow */}
      <div className="flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
        <div className="space-y-1">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                  {participant.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[15px] text-gray-900 truncate">
                      {participant.username}
                    </span>
                    {participant.id === currentUserId && (
                      <span className="text-xs text-gray-500 flex-shrink-0">(You)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <RoleIcon role={participant.role} />
                    <RoleBadge role={participant.role} />
                  </div>
                </div>
              </div>

              {isHost && participant.id !== currentUserId && participant.role !== 'host' && (
                <button
                  ref={(el) => {
                    if (el) buttonRefs.current.set(participant.id, el);
                    else buttonRefs.current.delete(participant.id);
                  }}
                  onClick={() => setOpenMenuId(openMenuId === participant.id ? null : participant.id)}
                  className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-gray-200 transition-all flex-shrink-0"
                >
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Render dropdown via Portal */}
      {openMenuId && openParticipant && menuButtonRef && (
        <ParticipantMenu
          participant={openParticipant}
          onClose={() => setOpenMenuId(null)}
          onAction={handleAction}
          buttonRef={{ current: menuButtonRef }}
        />
      )}
    </div>
  );
};