import type { GroupIdRequest, GroupIdResponse } from "../types/groupId.ts";
import { http } from "./http.ts";
import { ENDPOINTS } from "./endpoints.ts";

const GROUP_ID_ENDPOINT = ENDPOINTS.issueGroupId;

export const groupIdApi = async (payload: GroupIdRequest): Promise<GroupIdResponse> => {
  const { data } = await http.post<GroupIdResponse>(GROUP_ID_ENDPOINT, payload);
  return data;
}
