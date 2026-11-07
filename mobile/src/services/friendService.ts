import { api } from "@/services/api";
import {
  FriendComparison,
  FriendFishDex,
  FriendPublic,
  FriendRequestPublic,
} from "@/types";

export async function getFriends(): Promise<FriendPublic[]> {
  const { data } = await api.get<FriendPublic[]>("/friends");
  return data;
}

export async function getPendingRequests(): Promise<FriendRequestPublic[]> {
  const { data } = await api.get<FriendRequestPublic[]>("/friends/requests");
  return data;
}

export async function sendFriendRequest(username: string): Promise<FriendRequestPublic> {
  const { data } = await api.post<FriendRequestPublic>("/friends/request", { to_username: username });
  return data;
}

export async function acceptFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/accept/${requestId}`);
}

export async function rejectFriendRequest(requestId: number): Promise<void> {
  await api.post(`/friends/reject/${requestId}`);
}

export async function removeFriend(friendUserId: number): Promise<void> {
  await api.delete(`/friends/${friendUserId}`);
}

export async function getFriendFishDex(userId: number): Promise<FriendFishDex> {
  const { data } = await api.get<FriendFishDex>(`/friends/${userId}/fishdex`);
  return data;
}

export async function compareWithFriend(userId: number): Promise<FriendComparison> {
  const { data } = await api.get<FriendComparison>(`/friends/${userId}/compare`);
  return data;
}
