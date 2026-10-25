export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function formatCount(n: number): string {
  return `${n.toLocaleString("ru-RU")} ${plural(n, ["позиция", "позиции", "позиций"])}`;
}

/** Дата в формате ДД.ММ.ГГГГ */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatTime(date: Date): string {
  const time = date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) return time;
  return `${date.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })} ${time}`;
}
