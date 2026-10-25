export interface Row {
  id: number;
  /** Артикул */
  input: string;
  /** Количество — свободное поле, ни на что не влияет */
  qty: string;
}

let nextId = 1;

export const makeRow = (input = "", qty = ""): Row => ({ id: nextId++, input, qty });
