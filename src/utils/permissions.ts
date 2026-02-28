export const FULL_ACCESS_SCOPES = [
  "User.Read",
  "User.ReadBasic.All",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "ChannelMessage.Send",
  "TeamMember.Read.All",
  "Chat.ReadBasic",
  "Chat.ReadWrite",
];

export const READ_ONLY_SCOPES = [
  "User.Read",
  "User.ReadBasic.All",
  "Team.ReadBasic.All",
  "Channel.ReadBasic.All",
  "ChannelMessage.Read.All",
  "TeamMember.Read.All",
  "Chat.ReadBasic",
  "Chat.Read",
];

export function isReadOnlyMode(): boolean {
  const value = process.env.TEAMS_MCP_READ_ONLY?.toLowerCase()?.trim();
  return value === "true" || value === "1" || value === "yes";
}

export function getDelegatedScopes(readOnly: boolean): string[] {
  return readOnly ? READ_ONLY_SCOPES : FULL_ACCESS_SCOPES;
}
