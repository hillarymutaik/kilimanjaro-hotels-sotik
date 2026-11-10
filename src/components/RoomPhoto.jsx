import Icon from './Icon.jsx';

/**
 * A room's photo, or (for rooms that don't have one yet) a tidy placeholder that
 * invites the guest to see the room at reception.
 */
export default function RoomPhoto({ room, alt, className = '', lazy = true, compact = false }) {
  if (room.image) {
    return <img className={className} src={room.image} alt={alt ?? room.name} loading={lazy ? 'lazy' : undefined} />;
  }
  return (
    <div className={`photo-soon${compact ? ' photo-soon-compact' : ''} ${className}`} role="img" aria-label={`${room.name}: photo coming soon`}>
      <Icon name="bed" size={compact ? 26 : 34} />
      <strong>Photo coming soon</strong>
      {!compact && <span>Ask at reception to see the room</span>}
    </div>
  );
}
