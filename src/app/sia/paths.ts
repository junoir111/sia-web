// SIA: the wall is the first page after login; each bubble has its own page.
export const SIA_WALL_PATH = '/mur/';
export const SIA_BULLE_PATH = '/bulle/:roomId/';
export const siaBullePath = (roomId: string): string => `/bulle/${encodeURIComponent(roomId)}/`;
