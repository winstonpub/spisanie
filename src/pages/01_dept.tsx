import type { ComponentProps } from "react";
import { getCategory } from "../lib/settings";
import MainPage from "./MainPage";

type PageProps = Omit<ComponentProps<typeof MainPage>, "category">;

/** Страница отдела /01_dept — строительные материалы */
export default function Page01Dept(props: PageProps) {
  return <MainPage {...props} category={getCategory("01_dept")} />;
}
