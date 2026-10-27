export type PostType = 'guide' | 'resource' | 'skill' | 'mcp';
export type Access = 'free' | 'channel' | 'club';

export type Session = {
  user: { id: number; first_name?: string; last_name?: string; username?: string; photo_url?: string };
  subscribed: boolean;
  club: boolean;
  admin: boolean;
  channelUrl: string;
  botUsername: string;
  channelTitle: string;
  gateText: string;
  author: { name: string; avatar: string | null };
  brandTitle: string;
  waitlist: string[];
};

export type PostTeaser = {
  id: number;
  type: PostType;
  title: string;
  summary: string;
  cover_url: string | null;
  tags: string;
  access: Access;
  pinned: boolean;
  published_at: number | null;
  locked: 'channel' | 'club' | null;
  link_url?: string | null;
};

export type Post = PostTeaser & { body?: string; link_url?: string | null; install?: string | null };

export type Banner = {
  id: number;
  eyebrow: string;
  title: string;
  subtitle: string;
  image_url: string | null;
  bg: string;
  cta_label: string;
  action_type: 'post' | 'page' | 'url' | 'none';
  action_value: string;
};

export type MsgButton = { text: string; type: 'app' | 'url' | 'channel'; value?: string };

export const TYPE_LABEL: Record<PostType, string> = {
  guide: "Qo'llanma",
  resource: 'Resurs',
  skill: 'Skill',
  mcp: 'MCP',
};

export const ACCESS_LABEL: Record<Access, string> = {
  free: 'Hammaga ochiq',
  channel: 'Kanal obunachilari',
  club: 'Faqat AI Club',
};
