// Roles with delivery deadlines. Other crew roles still receive tasks without a due date.
export const DEADLINE_CREW_POSITIONS = new Set(['LEAD_PHOTO', 'ADDITIONAL_PHOTO', 'LEAD_VIDEO', 'VIDEO_EDITOR']);
export function canHaveDeadline(members, assigneeId) {
    return DEADLINE_CREW_POSITIONS.has(members.find(member => member.userId === assigneeId)?.crewPosition);
}
