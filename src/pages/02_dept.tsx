import type { ComponentProps } from "react";
import { getCategory } from "../lib/settings";
import MainPage from "./MainPage";

type PageProps = Omit<ComponentProps<typeof MainPage>, "category">;

/** Страница отдела /02_dept — столярные изделия */
export default function Page02Dept(props: PageProps) {
  return <MainPage {...props} category={getCategory("02_dept")} />;
}
