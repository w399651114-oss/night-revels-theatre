// 沿卷从右向左，以米记录位置。第四道屏临近留白入口。
export const stations = [1.5, 6.9, 12.3, 17.7, 25.4];
export const gates = [4.2, 9.6, 15, 20.4];
export const length = 27;
export const gap = [20.95, 23.55];
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const inGap = (s) => s >= gap[0] && s <= gap[1];
export const sectionAt = (s) =>
  stations.reduce(
    (best, v, i) => (Math.abs(s - v) < Math.abs(s - stations[best]) ? i : best),
    0,
  );
// 屏端伸到观者的直线路径上。临屏先向卷外侧绕行，越过后再回到原观距。
export function bypass(s) {
  return gates.reduce(
    (v, g) => Math.max(v, Math.exp(-((s - g) ** 2) / 0.52)),
    0,
  );
}
export function railPoint(s, offsetZ = 0) {
  const shoulder = bypass(s);
  const x = -s + 0.62 * (1 - shoulder);
  const distance = Math.min(...gates.map((g) => Math.abs(x + g)));
  const u = clamp((distance - 0.31) / 0.85, 0, 1);
  const minZ = 5.12 - 2.65 * u * u * (3 - 2 * u);
  return { x, z: Math.max(4.38 + 1.18 * shoulder + offsetZ, minZ) };
}
export const titles = ["听乐", "观舞", "暂歇", "清吹", "散宴"];
export const lines = [
  "琵琶一声起，众宾围榻而听。",
  "鼓点应舞步，屏间视线相交。",
  "乐声稍歇，净手之际稍作停驻。",
  "五伎并坐，管声沿绢面铺开。",
  "宾客渐散，回首再听来处。",
];
export const numerals = ["一", "二", "三", "四", "五"];
export const assetURL = (path) =>
  globalThis.__卷内资源?.[path] ??
  new URL(import.meta.env.BASE_URL + path, document.baseURI).href;
