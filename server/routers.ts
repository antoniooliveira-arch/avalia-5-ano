import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { COOKIE_NAME } from "@shared/const";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  addAuditLog,
  createAssessment,
  createClass,
  createQuestion,
  createSchool,
  createStudent,
  createSubject,
  createTeacher,
  getAssessmentWithQuestions,
  getAttempt,
  getQuestionWithOptions,
  getDashboardData,
  getStudentResult,
  getClassSummary,
  listClassReports,
  listIndividualReports,
  updateSubject,
  getQuestionAnalysis,
  getTeacherForUser,
  listAssessments,
  listClasses,
  listQuestions,
  listResults,
  listSchools,
  listStudents,
  listSubjects,
  listTeachers,
  maskCpf,
  publishAssessment,
  saveAnswer,
  startAttempt,
  submitAttempt,
  updateClass,
  updateSchool,
  updateStudent,
  updateTeacher,
} from "./db";

const idInput = z.object({ id: z.number().int().positive() });
const statusInput = z.enum(["active", "inactive"]);
const dateInput = z.coerce.date().optional();

async function ensureStaff(user: { id: number; role: string }) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher" && !(await getTeacherForUser(user.id))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso disponível apenas para administradores e professores." });
  }
  return false;
}

async function withDatabaseError<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) throw error;
    const message = error instanceof Error ? error.message : "Não foi possível concluir a operação.";
    throw new TRPCError({ code: "BAD_REQUEST", message });
  }
}

const adminCrudRouter = router({
  schools: router({
    list: adminProcedure.query(() => withDatabaseError(() => listSchools())),
    create: adminProcedure.input(z.object({ name: z.string().min(2), code: z.string().min(2).max(32) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createSchool(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "schools", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z.string().min(2).optional(), code: z.string().min(2).max(32).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateSchool(input.id, { name: input.name, code: input.code, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "schools", recordId: input.id });
      return { success: true };
    })),
  }),
  teachers: router({
    list: adminProcedure.query(() => withDatabaseError(() => listTeachers(undefined, true))),
    create: adminProcedure.input(z.object({ name: z.string().min(2), cpf: z.string().min(11), email: z.string().email().optional(), schoolId: z.number().int().positive(), userId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createTeacher(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "teachers", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z.string().min(2).optional(), cpf: z.string().min(11).optional(), email: z.string().email().optional(), schoolId: z.number().int().positive().optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateTeacher(input.id, { name: input.name, cpf: input.cpf, email: input.email, schoolId: input.schoolId, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "teachers", recordId: input.id });
      return { success: true };
    })),
  }),
  classes: router({
    list: adminProcedure.query(() => withDatabaseError(() => listClasses(undefined, true))),
    create: adminProcedure.input(z.object({ name: z.string().min(1), grade: z.string().min(1), schoolId: z.number().int().positive(), teacherId: z.number().int().positive(), year: z.number().int().min(2020).max(2100) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createClass(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "classes", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z.string().min(1).optional(), grade: z.string().min(1).optional(), schoolId: z.number().int().positive().optional(), teacherId: z.number().int().positive().optional(), year: z.number().int().min(2020).max(2100).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateClass(input.id, { name: input.name, grade: input.grade, schoolId: input.schoolId, teacherId: input.teacherId, year: input.year, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "classes", recordId: input.id });
      return { success: true };
    })),
  }),
  students: router({
    list: adminProcedure.input(z.object({ classId: z.number().int().positive().optional(), schoolId: z.number().int().positive().optional(), search: z.string().optional() }).optional()).query(({ input }) => withDatabaseError(() => listStudents({ ...input, isAdmin: true }))),
    create: adminProcedure.input(z.object({ name: z.string().min(2), cpf: z.string().min(11), schoolId: z.number().int().positive(), classId: z.number().int().positive() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createStudent(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "students", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z.string().min(2).optional(), cpf: z.string().min(11).optional(), schoolId: z.number().int().positive().optional(), classId: z.number().int().positive().optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateStudent(input.id, { name: input.name, cpf: input.cpf, schoolId: input.schoolId, classId: input.classId, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "students", recordId: input.id });
      return { success: true };
    })),
  }),
  subjects: router({
    list: adminProcedure.query(() => withDatabaseError(() => listSubjects(true))),
    create: adminProcedure.input(z.object({ name: z.string().min(2), code: z.string().min(2).max(32) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createSubject(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "subjects", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z.string().min(2).optional(), code: z.string().min(2).max(32).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateSubject(input.id, { name: input.name, code: input.code, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "subjects", recordId: input.id });
      return { success: true };
    })),
  }),
  questions: router({
    list: adminProcedure.input(z.object({ subjectId: z.number().int().positive().optional(), search: z.string().optional() }).optional()).query(({ input }) => withDatabaseError(() => listQuestions(input ?? {}))),
    get: adminProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getQuestionWithOptions(input.id))),
    create: adminProcedure.input(z.object({
      subjectId: z.number().int().positive(),
      statement: z.string().min(5),
      questionType: z.enum(["multiple_choice", "true_false", "short_answer"]),
      difficulty: z.enum(["easy", "medium", "hard"]),
      unitTheme: z.string().optional(),
      skill: z.string().optional(),
      descriptor: z.string().optional(),
      content: z.string().optional(),
      imageUrl: z.string().url().optional(),
      correctAnswer: z.string().min(1),
      points: z.number().int().min(1).max(100),
      options: z.array(z.object({ optionLabel: z.enum(["A", "B", "C", "D", "E"]), optionText: z.string().min(1), isCorrect: z.boolean() })).max(5),
    })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createQuestion(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "questions", recordId: Number(id) });
      return { id: Number(id) };
    })),
  }),
  assessments: router({
    list: adminProcedure.query(() => withDatabaseError(() => listAssessments())),
    get: adminProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getAssessmentWithQuestions(input.id))),
    create: adminProcedure.input(z.object({ name: z.string().min(2), description: z.string().optional(), subjectId: z.number().int().positive(), startDate: dateInput, endDate: dateInput, timeLimit: z.number().int().min(1).max(240), maxScore: z.number().min(1).max(100), allowSingleAttempt: z.boolean(), shuffleQuestions: z.boolean(), shuffleOptions: z.boolean(), showResultImmediately: z.boolean(), allowReview: z.boolean(), questionIds: z.array(z.number().int().positive()).min(1) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createAssessment({ ...input, createdBy: ctx.user.id });
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "assessments", recordId: Number(id) });
      return { id: Number(id) };
    })),
    publish: adminProcedure.input(idInput).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await publishAssessment(input.id);
      await addAuditLog({ userId: ctx.user.id, action: "publish", tableName: "assessments", recordId: input.id });
      return { success: true };
    })),
  }),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  public: router({
    catalog: publicProcedure.query(() => withDatabaseError(async () => {
      const [schoolRows, classRows, assessmentRows] = await Promise.all([listSchools(), listClasses(undefined, true), listAssessments()]);
      return { schools: schoolRows.filter((school) => school.status === "active"), classes: classRows.filter((classRow) => classRow.status === "active"), assessments: assessmentRows.filter((assessment) => assessment.status === "published") };
    })),
    startAttempt: publicProcedure.input(z.object({ assessmentId: z.number().int().positive(), schoolId: z.number().int().positive(), classId: z.number().int().positive(), cpf: z.string().min(11) })).mutation(({ input }) => withDatabaseError(() => startAttempt(input))),
    getAttempt: publicProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getAttempt(input.id))),
    saveAnswer: publicProcedure.input(z.object({ attemptId: z.number().int().positive(), questionId: z.number().int().positive(), selectedAnswer: z.string().optional().nullable() })).mutation(({ input }) => withDatabaseError(() => saveAnswer(input))),
    submitAttempt: publicProcedure.input(idInput.extend({ forceExpired: z.boolean().optional() })).mutation(({ input }) => withDatabaseError(() => submitAttempt(input.id, input.forceExpired))),
  }),
  admin: adminCrudRouter,
  dashboard: protectedProcedure.query(({ ctx }) => withDatabaseError(async () => {
    const isAdmin = ctx.user.role === "admin";
    await ensureStaff(ctx.user);
    return getDashboardData(ctx.user.id, isAdmin);
  })),
  teacher: router({
    classes: protectedProcedure.query(({ ctx }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return listClasses(ctx.user.id, isAdmin);
    })),
    students: protectedProcedure.input(z.object({ classId: z.number().int().positive().optional(), search: z.string().optional() }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return listStudents({ ...input, userId: ctx.user.id, isAdmin });
    })),
    results: protectedProcedure.input(z.object({ classId: z.number().int().positive().optional(), subjectId: z.number().int().positive().optional(), assessmentId: z.number().int().positive().optional(), teacherId: z.number().int().positive().optional(), skill: z.string().optional(), search: z.string().optional(), minPercentage: z.number().min(0).max(100).optional(), maxPercentage: z.number().min(0).max(100).optional(), from: dateInput, to: dateInput }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return listResults(input ?? {}, ctx.user.id, isAdmin);
    })),
    classSummary: protectedProcedure.input(idInput).query(({ ctx, input }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return getClassSummary(input.id, ctx.user.id, isAdmin);
    })),
    studentResult: protectedProcedure.input(idInput).query(({ ctx, input }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return getStudentResult(input.id, ctx.user.id, isAdmin);
    })),
    questionAnalysis: protectedProcedure.query(({ ctx }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return getQuestionAnalysis(ctx.user.id, isAdmin);
    })),
  }),
  reports: protectedProcedure.input(z.object({ reportType: z.enum(["general", "class", "student"]).optional(), schoolId: z.number().int().positive().optional(), classId: z.number().int().positive().optional(), teacherId: z.number().int().positive().optional(), subjectId: z.number().int().positive().optional(), assessmentId: z.number().int().positive().optional(), skill: z.string().optional(), search: z.string().optional(), minPercentage: z.number().min(0).max(100).optional(), maxPercentage: z.number().min(0).max(100).optional(), from: dateInput, to: dateInput }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
    const isAdmin = ctx.user.role === "admin";
    await ensureStaff(ctx.user);
    const filters = input ?? {};
    if (filters.reportType === "student") return listIndividualReports(filters, ctx.user.id, isAdmin);
    if (filters.reportType === "class") return listClassReports(filters, ctx.user.id, isAdmin);
    const rows = await listResults(filters, ctx.user.id, isAdmin);
    return rows.map((row) => ({
      aluno: row.student?.name ?? "",
      cpf: maskCpf(row.student?.cpf),
      escola: row.school?.name ?? "",
      turma: row.classRow?.name ?? "",
      professor: row.teacher?.name ?? "",
      avaliação: row.assessment?.name ?? "",
      disciplina: row.subject?.name ?? "",
      acertos: row.attempt.correctAnswers,
      erros: row.attempt.wrongAnswers,
      percentual: Number(row.attempt.percentage),
      nota: Number(row.attempt.score),
      data: row.attempt.finishedAt?.toISOString() ?? "",
    }));
  })),
});

export type AppRouter = typeof appRouter;
