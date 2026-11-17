import NotFoundArt from "../components/NotFoundArt";

interface NotFoundPageProps {
  basePath: string;
  onHome: () => void;
}

export default function NotFoundPage({ basePath, onHome }: NotFoundPageProps) {
  const homeHref = `${basePath}/`;

  return (
    <div className="min-h-screen bg-white">
      <main>
        <section
          data-nf-phase="play"
          className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#20282B] px-6 py-16 text-center text-white"
          aria-label="Страница не найдена (404)"
          style={{ fontFamily: "'Onest', ui-sans-serif, system-ui, sans-serif" }}
        >
          <div className="flex w-full max-w-[560px] flex-col items-center">
            <div
              className="w-full transition-opacity duration-500 opacity-100"
              aria-hidden="false"
              style={{ maxWidth: 280 }}
            >
              <NotFoundArt />
            </div>
            <div
              data-testid="nf-text"
              className="relative z-10 flex max-w-xl flex-col items-center text-center"
              style={{ marginTop: "calc(24px - min(280px, 100%) * 42.7 / 236)" }}
            >
              <h1 className="text-[46px] font-black leading-[0.98] tracking-[-0.02em] sm:text-[64px] lg:text-[76px]">
                Страница
                <br />
                <span className="text-[#f5c400]">не найдена</span>
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-relaxed text-white/65 lg:text-[17px]">
                Такого адреса на сайте нет: возможно, в ссылке опечатка или страница была
                переименована.
              </p>
              <div className="mt-8 flex justify-center">
                <a
                  href={homeHref}
                  onClick={(event) => {
                    event.preventDefault();
                    onHome();
                  }}
                  className="inline-flex h-[52px] items-center gap-2 rounded-2xl bg-[#f5c400] px-7 text-[15px] font-extrabold text-[#20282B] transition-all hover:gap-3 hover:bg-[#ffe066]"
                >
                  На главную
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
