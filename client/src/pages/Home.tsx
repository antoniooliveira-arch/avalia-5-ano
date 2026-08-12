import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3, BookOpenCheck, ClipboardCheck, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";

const highlights = [
  { icon: ClipboardCheck, title: "Aplicação sem atrito", text: "Uma experiência guiada para o aluno responder, revisar e enviar a avaliação com segurança." },
  { icon: BarChart3, title: "Leitura pedagógica", text: "Dashboards que transformam respostas em decisões claras por turma, disciplina e habilidade." },
  { icon: ShieldCheck, title: "Dados protegidos", text: "Perfis de acesso e CPF mascarado para preservar a privacidade da comunidade escolar." },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="relative z-10 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="container flex h-20 items-center justify-between gap-4">
          <button className="flex items-center gap-3 text-left" onClick={() => setLocation("/")} aria-label="Voltar à página inicial">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <span className="block font-[Manrope] text-base font-extrabold tracking-tight">Avalia 5º Ano</span>
              <span className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Plataforma escolar</span>
            </span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground md:inline">Uma leitura mais inteligente da aprendizagem</span>
            <Button variant="outline" className="rounded-full border-primary/20 bg-card/70" onClick={() => setLocation(user ? "/admin" : "/admin")}>
              {user ? "Abrir painel" : "Acesso da equipe"}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main>
        <section className="surface-grid relative isolate">
          <div className="absolute -left-32 top-10 -z-10 h-80 w-80 rounded-full bg-secondary/70 blur-3xl" />
          <div className="absolute -right-24 top-0 -z-10 h-96 w-96 rounded-full bg-accent/70 blur-3xl" />
          <div className="container grid gap-14 py-16 lg:grid-cols-[1.03fr_.97fr] lg:items-center lg:py-24">
            <div className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/75 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-primary shadow-sm">
                <span className="h-2 w-2 rounded-full bg-[oklch(0.65_0.15_165)]" />
                Avaliações do 5º ano
              </div>
              <h1 className="max-w-xl text-5xl font-extrabold leading-[1.05] tracking-[-0.055em] text-primary sm:text-6xl">
                Avaliar melhor para ensinar com mais clareza.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
                Uma plataforma elegante para aplicar avaliações, organizar a rotina escolar e enxergar o desenvolvimento de cada aluno sem perder o contexto pedagógico.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="h-12 rounded-full px-6 shadow-xl shadow-primary/20" onClick={() => setLocation("/student")}>
                  Iniciar avaliação
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 rounded-full border-primary/20 bg-card/70 px-6" onClick={() => setLocation("/admin")}>
                  Conhecer o painel
                </Button>
              </div>
              <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> CPF sempre mascarado</span>
                <span className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-primary" /> Feito para escolas</span>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[520px]">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-primary/10 blur-2xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-primary p-5 text-primary-foreground shadow-2xl shadow-primary/20">
                <div className="flex items-center justify-between border-b border-white/15 pb-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Visão geral</p>
                    <p className="mt-1 font-[Manrope] text-xl font-bold">Desempenho da escola</p>
                  </div>
                  <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">2026</div>
                </div>
                <div className="grid grid-cols-2 gap-3 py-5">
                  {[{ value: "428", label: "Alunos", tone: "bg-white/10" }, { value: "72,5%", label: "Média geral", tone: "bg-[oklch(0.55_0.12_192)]/70" }, { value: "12", label: "Avaliações", tone: "bg-white/10" }, { value: "94,2%", label: "Participação", tone: "bg-[oklch(0.64_0.14_50)]/80" }].map((item) => (
                    <div key={item.label} className={`rounded-2xl p-4 ${item.tone}`}>
                      <p className="font-[Manrope] text-2xl font-extrabold tracking-tight">{item.value}</p>
                      <p className="mt-1 text-xs font-semibold text-white/60">{item.label}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-2xl bg-white/8 p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-bold">Média por disciplina</p>
                    <span className="text-xs text-white/55">Aproveitamento</span>
                  </div>
                  {[{ label: "Língua Portuguesa", value: 78, color: "bg-[oklch(0.64_0.14_50)]" }, { label: "Matemática", value: 68, color: "bg-[oklch(0.55_0.12_192)]" }].map((item) => (
                    <div key={item.label} className="mb-4 last:mb-0">
                      <div className="mb-1.5 flex justify-between text-xs font-semibold text-white/70"><span>{item.label}</span><span>{item.value}%</span></div>
                      <div className="h-2 rounded-full bg-white/10"><div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} /></div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
                  <BookOpenCheck className="h-5 w-5 text-[oklch(0.72_0.14_85)]" />
                  <span>Questões com maior índice de erro identificadas para a próxima intervenção.</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="container py-16 lg:py-20">
          <div className="mb-10 max-w-2xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Uma plataforma, três perspectivas</p>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">Menos planilhas. Mais tempo para interpretar a aprendizagem.</h2>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.title} className="lift-on-hover rounded-3xl border border-border/80 bg-card p-6 soft-shadow">
                <div className="mb-6 grid h-11 w-11 place-items-center rounded-2xl bg-secondary text-primary"><item.icon className="h-5 w-5" /></div>
                <h3 className="text-lg font-bold text-primary">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border/70 bg-card/60">
          <div className="container flex flex-col items-start justify-between gap-6 py-10 md:flex-row md:items-center">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Pronto para começar?</p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">A próxima avaliação começa aqui.</h2>
            </div>
            <Button className="rounded-full px-6" onClick={() => setLocation("/student")}>Entrar na avaliação <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </section>
      </main>

      <footer className="container flex flex-col gap-3 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© 2026 Avalia 5º Ano. Educação orientada por evidências.</p>
        <p className="font-semibold text-primary/70">Língua Portuguesa · Matemática</p>
      </footer>
    </div>
  );
}
