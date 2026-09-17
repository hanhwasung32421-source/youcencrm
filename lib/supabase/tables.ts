// 이 Supabase 프로젝트(APPS)는 여러 앱이 함께 씁니다.
// 그래서 이 앱이 쓰는 테이블은 전부 "youtubeCRM_" 접두어를 붙입니다.
// 테이블 이름을 바꿔야 할 일이 생기면 이 파일 하나만 고치면 됩니다.

const PREFIX = 'youtubeCRM_'

export const TABLES = {
  roles: `${PREFIX}roles`,
  crmUsers: `${PREFIX}crm_users`,
  userRoles: `${PREFIX}user_roles`,
  roleMenuPermissions: `${PREFIX}role_menu_permissions`,
  channels: `${PREFIX}channels`,
  channelMemberships: `${PREFIX}channel_memberships`,
  youtubeAccounts: `${PREFIX}youtube_accounts`,
  networkZones: `${PREFIX}network_zones`,
  loginEvents: `${PREFIX}login_events`,
  attendanceDays: `${PREFIX}attendance_days`,
  attendanceEvents: `${PREFIX}attendance_events`,
  uploadPlans: `${PREFIX}upload_plans`,
  videos: `${PREFIX}videos`,
  workActivityEvents: `${PREFIX}work_activity_events`,
  videoSnapshots: `${PREFIX}video_snapshots`,
  videoAnalyticsDaily: `${PREFIX}video_analytics_daily`,
  channelAnalyticsDaily: `${PREFIX}channel_analytics_daily`,
  auditLogs: `${PREFIX}audit_logs`
} as const
