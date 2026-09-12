const socketsByUser = new Map<string, Set<string>>()

export function userConnected(userId: string, socketId: string) {
  const sockets = socketsByUser.get(userId) ?? new Set<string>()
  sockets.add(socketId); socketsByUser.set(userId, sockets)
  return socketsByUser.size
}
export function userDisconnected(userId: string, socketId: string) {
  const sockets = socketsByUser.get(userId)
  sockets?.delete(socketId)
  if (sockets?.size === 0) socketsByUser.delete(userId)
  return socketsByUser.size
}
export const onlineUserCount = () => socketsByUser.size
