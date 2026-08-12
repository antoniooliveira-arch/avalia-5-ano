import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, GraduationCap, LockKeyhole, RotateCcw, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

function formatCpf(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function validCpf(value: string) {
  const cpf = value.replace(/\D/g, "");
  if (cpf.length !== 11 || /^([0-9])\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function StudentExam() {
  const [, setLocation] = useLocation();
  const catalogQuery = trpc.public.catalog.useQuery();
  const startAttempt = trpc.public.startAttempt.useMutation();
  const saveAnswer = trpc.public.saveAnswer.useMutation();
  const submitAttempt = trpc.public.submitAttempt.useMutation();
  const [step, setStep] = useState<"school" | "class" | "cpf" | "assessment">("school");
  const [schoolId, setSchoolId] = useState("");
  const [classId, setClassId] = useState("");
  const [cpf, setCpf] = useState("");
  const [assessmentId, setAssessmentId] = useState("");
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [examMode, setExamMode] = useState<"exam" | "review" | "result">("exam");
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitResult, setSubmitResult] = useState<{ percentage: number; score: number; correctAnswers: number; wrongAnswers: number; totalQuestions: number } | null>(null);
  const attemptQuery = trpc.public.getAttempt.useQuery({ id: attemptId ?? 0 }, { enabled: Boolean(attemptId) && examMode !== "result" });

  const catalog = catalogQuery.data;
  const selectedSchool = catalog?.schools.find((school) => school.id === Number(schoolId));
  const classes = catalog?.classes.filter((classRow) => classRow.schoolId === Number(schoolId)) ?? [];
  const selectedAssessment = catalog?.assessments.find((assessment) => assessment.id === Number(assessmentId));
  const questions = attemptQuery.data?.assessment?.questions ?? [];
  const question = questions[currentQuestion];
  const answeredCount = Object.values(answers).filter(Boolean).length;

  useEffect(() => {
    if (!attemptQuery.data?.savedAnswers) return;
    const saved: Record<number, string> = {};
    for (const item of attemptQuery.data.savedAnswers) {
      if (item.selectedAnswer) saved[item.questionId] = item.selectedAnswer;
    }
    setAnswers(saved);
  }, [attemptQuery.data?.savedAnswers]);

  useEffect(() => {
    if (examMode !== "exam" || !attemptQuery.data?.attempt || !attemptQuery.data.assessment) return;
    const startedAt = new Date(attemptQuery.data.attempt.startedAt).getTime();
    const limit = attemptQuery.data.assessment.timeLimit * 60;
    const tick = () => {
      const remaining = Math.ceil((startedAt + limit * 1000 - Date.now()) / 1000);
      setTimeLeft(remaining);
      if (remaining <= 0 && attemptId) {
        setExamMode("result");
        submitAttempt.mutate({ id: attemptId, forceExpired: true }, { onSuccess: setSubmitResult });
      }
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [attemptQuery.data?.attempt, attemptQuery.data?.assessment, examMode, attemptId]);

  const setAnswer = (value: string) => {
    if (!question?.question) return;
    setAnswers((current) => ({ ...current, [question.question!.id]: value }));
    if (attemptId) saveAnswer.mutate({ attemptId, questionId: question.question.id, selectedAnswer: value });
  };

  const start = async () => {
    if (!schoolId || !classId || !validCpf(cpf) || !assessmentId) return;
    const attempt = await startAttempt.mutateAsync({ assessmentId: Number(assessmentId), schoolId: Number(schoolId), classId: Number(classId), cpf });
    setAttemptId(attempt.id);
  };

  const finish = () => {
    if (!attemptId) return;
    submitAttempt.mutate({ id: attemptId }, { onSuccess: (result) => { setSubmitResult(result); setExamMode("result"); } });
  };

  const stepNumber = useMemo(() => ({ school: 1, class: 2, cpf: 3, assessment: 4 }[step]), [step]);

  if (examMode === "result" && submitResult) {
    return (
      <div className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div><p className="font-[Manrope] font-extrabold text-primary">Avalia 5º Ano</p><p className="text-xs text-muted-foreground">Resultado registrado</p></div></div>
          <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-card soft-shadow">
            <div className="bg-primary px-7 py-9 text-primary-foreground sm:px-10"><div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/12"><CheckCircle2 className="h-7 w-7 text-[oklch(0.78_0.14_165)]" /></div><p className="text-sm font-bold uppercase tracking-[0.16em] text-white/60">Avaliação concluída</p><h1 className="mt-2 text-3xl font-extrabold tracking-tight">Muito bem, sua resposta foi enviada.</h1><p className="mt-3 max-w-lg text-sm leading-6 text-white/70">O resultado foi registrado com segurança. Converse com seu professor para entender os próximos passos da aprendizagem.</p></div>
            <div className="grid gap-4 p-7 sm:grid-cols-3 sm:p-10">
              {[{ label: "Aproveitamento", value: `${submitResult.percentage}%` }, { label: "Acertos", value: `${submitResult.correctAnswers}/${submitResult.totalQuestions}` }, { label: "Nota", value: submitResult.score.toFixed(1).replace(".", ",") }].map((item) => <div key={item.label} className="rounded-2xl bg-muted/60 p-5"><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p><p className="mt-2 font-[Manrope] text-3xl font-extrabold text-primary">{item.value}</p></div>)}
            </div>
            <div className="flex flex-col gap-3 border-t border-border/70 p-7 sm:flex-row sm:justify-end sm:p-10"><Button variant="outline" className="rounded-full" onClick={() => { setExamMode("exam"); setAttemptId(null); setSubmitResult(null); setStep("school"); setSchoolId(""); setClassId(""); setCpf(""); setAssessmentId(""); setAnswers({}); }}><RotateCcw className="mr-2 h-4 w-4" /> Nova avaliação</Button><Button className="rounded-full" onClick={() => setLocation("/")}>Voltar ao início</Button></div>
          </div>
        </div>
      </div>
    );
  }

  if (attemptId) {
    const progress = questions.length ? ((currentQuestion + 1) / questions.length) * 100 : 0;
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-20 border-b border-border/70 bg-background/90 backdrop-blur-xl">
          <div className="container flex min-h-20 items-center justify-between gap-4 py-3">
            <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><GraduationCap className="h-5 w-5" /></div><div><p className="font-[Manrope] font-extrabold tracking-tight text-primary">{attemptQuery.data?.assessment?.name ?? selectedAssessment?.name}</p><p className="text-xs text-muted-foreground">{attemptQuery.data?.student?.name ?? "Aluno"} · {selectedSchool?.name}</p></div></div>
            <div className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-extrabold ${timeLeft < 300 ? "border-destructive/30 bg-destructive/10 text-destructive" : "border-primary/15 bg-secondary text-primary"}`}><Clock3 className="h-4 w-4" />{formatTime(timeLeft)}</div>
          </div>
          <div className="h-1 bg-muted"><div className="h-full bg-[oklch(0.64_0.14_50)] transition-all" style={{ width: `${progress}%` }} /></div>
        </header>
        <main className="container max-w-4xl py-8 sm:py-12">
          {attemptQuery.isLoading ? <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">Carregando sua avaliação…</div> : question?.question ? <>
            <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Questão {currentQuestion + 1} de {questions.length}</p><h1 className="mt-2 text-2xl font-extrabold tracking-tight text-primary sm:text-3xl">Leia com atenção e escolha uma resposta.</h1></div><span className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{answeredCount} respondida{answeredCount === 1 ? "" : "s"}</span></div>
            <div className="rounded-[2rem] border border-border/70 bg-card p-6 soft-shadow sm:p-10">
              <div className="mb-8 flex flex-wrap gap-2"><span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{attemptQuery.data?.assessment?.name}</span><span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">{question.question.difficulty === "easy" ? "Fácil" : question.question.difficulty === "hard" ? "Desafiadora" : "Intermediária"}</span></div>
              <p className="whitespace-pre-wrap text-xl font-semibold leading-9 text-primary sm:text-2xl">{question.question.statement}</p>
              {question.question.imageUrl ? <img src={question.question.imageUrl} alt="Imagem da questão" className="my-7 max-h-72 rounded-2xl object-contain" /> : null}
              <div className="mt-9 grid gap-3">{question.options.map((option) => { const checked = answers[question.question!.id] === option.optionLabel; return <button key={option.id} className={`group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all ${checked ? "border-primary bg-secondary shadow-sm" : "border-border/80 bg-background hover:border-primary/40 hover:bg-muted/50"}`} onClick={() => setAnswer(option.optionLabel)}><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border text-sm font-extrabold ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground group-hover:border-primary group-hover:text-primary"}`}>{checked ? <Check className="h-4 w-4" /> : option.optionLabel}</span><span className={`text-base font-semibold ${checked ? "text-primary" : "text-foreground"}`}>{option.optionText}</span></button>; })}</div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"><Button variant="outline" className="rounded-full" disabled={currentQuestion === 0} onClick={() => setCurrentQuestion((value) => Math.max(0, value - 1))}><ChevronLeft className="mr-2 h-4 w-4" /> Anterior</Button>{currentQuestion === questions.length - 1 ? <Button className="rounded-full" onClick={() => setExamMode("review")}>Revisar respostas <ArrowRight className="ml-2 h-4 w-4" /></Button> : <Button className="rounded-full" onClick={() => setCurrentQuestion((value) => Math.min(questions.length - 1, value + 1))}>Próxima <ChevronRight className="ml-2 h-4 w-4" /></Button>}</div>
          </> : <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">Não foi possível carregar as questões desta avaliação.</div>}
          {examMode === "review" ? <div className="fixed inset-0 z-30 grid place-items-center bg-primary/25 p-4 backdrop-blur-sm"><div className="w-full max-w-lg rounded-[2rem] border border-border bg-card p-7 shadow-2xl sm:p-9"><div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-foreground"><Send className="h-5 w-5" /></div><p className="text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Revisão final</p><h2 className="mt-2 text-2xl font-extrabold text-primary">Tudo pronto para enviar?</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Você respondeu {answeredCount} de {questions.length} questões. Confira cada item antes do envio final.</p><div className="mt-5 grid max-h-52 grid-cols-4 gap-2 overflow-auto rounded-2xl bg-muted/50 p-3 sm:grid-cols-5">{questions.map((item, index) => { const answered = item.question ? Boolean(answers[item.question.id]) : false; return <button key={item.id} type="button" onClick={() => { setCurrentQuestion(index); setExamMode("exam"); }} className={`rounded-xl border p-2 text-center text-xs font-extrabold ${answered ? "border-primary bg-secondary text-primary" : "border-border bg-card text-muted-foreground"}`}><span className="block">Q{index + 1}</span><span className="mt-1 block text-[10px] font-semibold">{answered ? "Respondida" : "Em branco"}</span></button>; })}</div><div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end"><Button variant="outline" className="rounded-full" onClick={() => setExamMode("exam")}>Voltar à prova</Button><Button className="rounded-full" onClick={finish} disabled={submitAttempt.isPending}>Confirmar envio <Send className="ml-2 h-4 w-4" /></Button></div></div></div> : null}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/70 bg-background/85 backdrop-blur-xl"><div className="container flex h-20 items-center justify-between"><button onClick={() => setLocation("/")} className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><div className="text-left"><p className="font-[Manrope] font-extrabold text-primary">Avalia 5º Ano</p><p className="text-xs text-muted-foreground">Área do aluno</p></div></button><div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"><LockKeyhole className="h-4 w-4 text-primary" /> Ambiente seguro</div></div></header>
      <main className="container grid max-w-6xl gap-10 py-10 lg:grid-cols-[.74fr_1.26fr] lg:items-start lg:py-16">
        <section className="surface-grid overflow-hidden rounded-[2rem] bg-primary p-7 text-primary-foreground shadow-xl shadow-primary/15 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">Aplicação de avaliação</p><h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Responda com calma. Você está no caminho certo.</h1><p className="mt-5 text-sm leading-7 text-white/70">Preencha seus dados na ordem indicada para acessar a avaliação liberada pela sua escola.</p><div className="mt-10 space-y-4">{[{ n: 1, title: "Escola", done: stepNumber > 1 }, { n: 2, title: "Turma", done: stepNumber > 2 }, { n: 3, title: "CPF", done: stepNumber > 3 }, { n: 4, title: "Avaliação", done: false }].map((item) => <div key={item.n} className={`flex items-center gap-3 rounded-2xl border p-3 ${stepNumber === item.n ? "border-white/30 bg-white/12" : "border-white/10 bg-white/5"}`}><span className={`grid h-8 w-8 place-items-center rounded-xl text-xs font-extrabold ${item.done ? "bg-[oklch(0.72_0.14_165)] text-primary" : stepNumber === item.n ? "bg-white text-primary" : "bg-white/10 text-white/60"}`}>{item.done ? <Check className="h-4 w-4" /> : item.n}</span><span className={`text-sm font-bold ${stepNumber === item.n ? "text-white" : "text-white/60"}`}>{item.title}</span></div>)}</div><div className="mt-10 flex gap-3 border-t border-white/10 pt-6 text-xs leading-5 text-white/60"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.72_0.14_165)]" />Seu CPF é usado apenas para localizar sua inscrição e não fica exposto na plataforma.</div></section>
        <section className="rounded-[2rem] border border-border/70 bg-card p-6 soft-shadow sm:p-10">
          <div className="mb-8 flex items-start justify-between gap-5"><div><p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">Identificação do aluno</p><h2 className="mt-2 text-2xl font-extrabold tracking-tight text-primary">Vamos começar</h2><p className="mt-2 text-sm text-muted-foreground">Etapa {stepNumber} de 4 · Os campos são obrigatórios.</p></div><div className="rounded-2xl bg-secondary px-3 py-2 text-xs font-bold text-primary">5º ano</div></div>
          {catalogQuery.isLoading ? <div className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">Carregando escolas e avaliações disponíveis…</div> : catalogQuery.error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-5 text-sm text-destructive">Não foi possível carregar os dados agora. Tente novamente em instantes.</div> : <div className="space-y-6">
            {step === "school" ? <div className="space-y-3"><Label htmlFor="school">1. Escolha sua escola</Label><select id="school" value={schoolId} onChange={(event) => setSchoolId(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"><option value="">Selecione uma escola</option>{catalog?.schools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}</select><Button className="mt-3 w-full rounded-xl" disabled={!schoolId} onClick={() => setStep("class")}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button></div> : null}
            {step === "class" ? <div className="space-y-3"><Label htmlFor="class">2. Escolha sua turma</Label><p className="text-xs text-muted-foreground">Escola selecionada: {selectedSchool?.name}</p><select id="class" value={classId} onChange={(event) => setClassId(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"><option value="">Selecione uma turma</option>{classes.map((classRow) => <option key={classRow.id} value={classRow.id}>{classRow.name} · {classRow.year}</option>)}</select><div className="flex gap-3"><Button variant="outline" className="rounded-xl" onClick={() => setStep("school")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button><Button className="flex-1 rounded-xl" disabled={!classId} onClick={() => setStep("cpf")}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div> : null}
            {step === "cpf" ? <div className="space-y-3"><Label htmlFor="cpf">3. Digite seu CPF</Label><p className="text-xs text-muted-foreground">O campo é protegido e o número não ficará visível.</p><Input id="cpf" type="password" inputMode="numeric" autoComplete="off" value={cpf} onChange={(event) => setCpf(formatCpf(event.target.value))} placeholder="11 dígitos" className="h-12 rounded-xl text-lg tracking-[0.25em]" /><p className="text-xs text-muted-foreground">{cpf.length}/11 dígitos informados</p><div className="flex gap-3"><Button variant="outline" className="rounded-xl" onClick={() => setStep("class")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button><Button className="flex-1 rounded-xl" disabled={!validCpf(cpf)} onClick={() => setStep("assessment")}>Continuar <ArrowRight className="ml-2 h-4 w-4" /></Button></div></div> : null}
            {step === "assessment" ? <div className="space-y-3"><Label htmlFor="assessment">4. Selecione a avaliação</Label><select id="assessment" value={assessmentId} onChange={(event) => setAssessmentId(event.target.value)} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"><option value="">Selecione uma avaliação</option>{catalog?.assessments.map((assessment) => <option key={assessment.id} value={assessment.id}>{assessment.name}</option>)}</select>{selectedAssessment ? <div className="rounded-2xl bg-muted/60 p-4 text-sm"><div className="flex justify-between gap-4"><span className="font-semibold text-primary">{selectedAssessment.name}</span><span className="font-bold text-primary">{selectedAssessment.timeLimit} min</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">A prova será corrigida automaticamente após o envio. Revise suas respostas antes de finalizar.</p></div> : null}<div className="flex gap-3"><Button variant="outline" className="rounded-xl" onClick={() => setStep("cpf")}><ArrowLeft className="mr-2 h-4 w-4" /> Voltar</Button><Button className="flex-1 rounded-xl" disabled={!assessmentId || startAttempt.isPending} onClick={start}>{startAttempt.isPending ? "Preparando…" : "Iniciar avaliação"}<ArrowRight className="ml-2 h-4 w-4" /></Button></div>{startAttempt.error ? <p className="rounded-xl bg-destructive/5 p-3 text-xs text-destructive">{startAttempt.error.message}</p> : null}</div> : null}
          </div>}
        </section>
      </main>
    </div>
  );
}
