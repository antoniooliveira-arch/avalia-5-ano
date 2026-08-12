import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  answers,
  assessmentQuestions,
  assessments,
  attempts,
  auditLogs,
  classes,
  InsertUser,
  questionOptions,
  questions,
  schools,
  students,
  subjects,
  teachers,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateObjectiveResult } from "./assessment-utils";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL });
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

function requireDb() {
  if (!_db) throw new Error("Database unavailable");
  return _db;
}

export function normalizeCpf(cpf: string) {
  return cpf.replace(/\D/g, "");
}

export function maskCpf(cpf: string | null | undefined) {
  const digits = normalizeCpf(cpf ?? "");
  if (digits.length !== 11) return "•••.•••.•••-••";
  return `${digits.slice(0, 3)}.•••.•••-${digits.slice(-2)}`;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getTeacherForUser(userId: number) {
  const db = requireDb();
  const result = await db.select().from(teachers).where(eq(teachers.userId, userId)).limit(1);
  return result[0];
}

export async function getTeacherClassIds(userId: number) {
  const teacher = await getTeacherForUser(userId);
  if (!teacher) return [];
  const db = requireDb();
  const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, teacher.id));
  return rows.map((row) => row.id);
}

export async function listSchools() {
  return requireDb().select().from(schools).orderBy(asc(schools.name));
}

export async function createSchool(input: { name: string; code: string }) {
  const db = requireDb();
  const result = await db.insert(schools).values({ name: input.name, code: input.code.toUpperCase() }).returning({ id: schools.id });
  return result[0].id;
}

export async function updateSchool(id: number, input: { name?: string; code?: string; status?: "active" | "inactive" }) {
  await requireDb().update(schools).set({ ...input, code: input.code?.toUpperCase() }).where(eq(schools.id, id));
}

export async function listTeachers(userId?: number, isAdmin = false) {
  const db = requireDb();
  if (userId && !isAdmin) {
    return db.select().from(teachers).where(eq(teachers.userId, userId)).orderBy(asc(teachers.name));
  }
  return db.select().from(teachers).orderBy(asc(teachers.name));
}

export async function createTeacher(input: { name: string; cpf: string; email?: string; schoolId: number; userId?: number }) {
  const db = requireDb();
  const result = await db.insert(teachers).values({
    name: input.name,
    cpf: normalizeCpf(input.cpf),
    email: input.email || null,
    schoolId: input.schoolId,
    userId: input.userId || null,
  }).returning({ id: teachers.id });
  return result[0].id;
}

export async function updateTeacher(id: number, input: { name?: string; cpf?: string; email?: string; status?: "active" | "inactive"; schoolId?: number }) {
  await requireDb().update(teachers).set({ ...input, cpf: input.cpf ? normalizeCpf(input.cpf) : undefined }).where(eq(teachers.id, id));
}

export async function listClasses(userId?: number, isAdmin = false) {
  const db = requireDb();
  if (userId && !isAdmin) {
    const teacher = await getTeacherForUser(userId);
    if (!teacher) return [];
    return db.select().from(classes).where(eq(classes.teacherId, teacher.id)).orderBy(desc(classes.year), asc(classes.name));
  }
  return db.select().from(classes).orderBy(desc(classes.year), asc(classes.name));
}

export async function createClass(input: { name: string; grade: string; schoolId: number; teacherId: number; year: number }) {
  const result = await requireDb().insert(classes).values(input).returning({ id: classes.id });
  return result[0].id;
}

export async function updateClass(id: number, input: { name?: string; grade?: string; schoolId?: number; teacherId?: number; year?: number; status?: "active" | "inactive" }) {
  await requireDb().update(classes).set(input).where(eq(classes.id, id));
}

export async function listStudents(options: { userId?: number; isAdmin?: boolean; classId?: number; schoolId?: number; search?: string }) {
  const db = requireDb();
  const conditions = [];
  if (options.classId) conditions.push(eq(students.classId, options.classId));
  if (options.schoolId) conditions.push(eq(students.schoolId, options.schoolId));
  if (options.search) {
    conditions.push(or(like(students.name, `%${options.search}%`), like(students.cpf, `%${normalizeCpf(options.search)}%`)));
  }
  if (options.userId && !options.isAdmin) {
    const ids = await getTeacherClassIds(options.userId);
    if (!ids.length) return [];
    conditions.push(inArray(students.classId, ids));
  }
  return db.select().from(students).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(students.name));
}

export async function createStudent(input: { name: string; cpf: string; schoolId: number; classId: number }) {
  const result = await requireDb().insert(students).values({ ...input, cpf: normalizeCpf(input.cpf) }).returning({ id: students.id });
  return result[0].id;
}

export async function updateStudent(id: number, input: { name?: string; cpf?: string; schoolId?: number; classId?: number; status?: "active" | "inactive" }) {
  await requireDb().update(students).set({ ...input, cpf: input.cpf ? normalizeCpf(input.cpf) : undefined }).where(eq(students.id, id));
}

export async function listSubjects(includeInactive = false) {
  return requireDb().select().from(subjects).where(includeInactive ? undefined : eq(subjects.status, "active")).orderBy(asc(subjects.name));
}

export async function createSubject(input: { name: string; code: string }) {
  const result = await requireDb().insert(subjects).values(input).returning({ id: subjects.id });
  return result[0].id;
}

export async function updateSubject(id: number, input: { name?: string; code?: string; status?: "active" | "inactive" }) {
  await requireDb().update(subjects).set(input).where(eq(subjects.id, id));
}

export async function listQuestions(options: { subjectId?: number; search?: string }) {
  const db = requireDb();
  const conditions = [eq(questions.status, "active")];
  if (options.subjectId) conditions.push(eq(questions.subjectId, options.subjectId));
  if (options.search) conditions.push(like(questions.statement, `%${options.search}%`));
  return db.select().from(questions).where(and(...conditions)).orderBy(desc(questions.createdAt));
}

export async function getQuestionWithOptions(id: number) {
  const db = requireDb();
  const question = (await db.select().from(questions).where(eq(questions.id, id)).limit(1))[0];
  if (!question) return undefined;
  const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, id)).orderBy(asc(questionOptions.id));
  return { ...question, options };
}

export async function createQuestion(input: {
  subjectId: number;
  statement: string;
  questionType: "multiple_choice" | "true_false" | "short_answer";
  difficulty: "easy" | "medium" | "hard";
  unitTheme?: string;
  skill?: string;
  descriptor?: string;
  content?: string;
  imageUrl?: string;
  correctAnswer: string;
  points: number;
  options: Array<{ optionLabel: "A" | "B" | "C" | "D" | "E"; optionText: string; isCorrect: boolean }>;
}) {
  const db = requireDb();
  const result = await db.insert(questions).values({
    subjectId: input.subjectId,
    statement: input.statement,
    questionType: input.questionType,
    difficulty: input.difficulty,
    unitTheme: input.unitTheme || null,
    skill: input.skill || null,
    descriptor: input.descriptor || null,
    content: input.content || null,
    imageUrl: input.imageUrl || null,
    correctAnswer: input.correctAnswer,
    points: input.points,
  }).returning({ id: questions.id });
  const questionId = result[0].id;
  if (input.options.length) {
    await db.insert(questionOptions).values(input.options.map((option) => ({ ...option, questionId })));
  }
  return questionId;
}

export async function listAssessments() {
  return requireDb().select().from(assessments).orderBy(desc(assessments.createdAt));
}

export async function getAssessmentWithQuestions(id: number) {
  const db = requireDb();
  const assessment = (await db.select().from(assessments).where(eq(assessments.id, id)).limit(1))[0];
  if (!assessment) return undefined;
  const links = await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, id)).orderBy(asc(assessmentQuestions.questionOrder));
  const questionIds = links.map((link) => link.questionId);
  const questionRows = questionIds.length ? await db.select().from(questions).where(inArray(questions.id, questionIds)) : [];
  const optionRows = questionIds.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds)) : [];
  const questionMap = new Map(questionRows.map((question) => [question.id, question]));
  const optionMap = new Map<number, typeof optionRows>();
  for (const option of optionRows) optionMap.set(option.questionId, [...(optionMap.get(option.questionId) ?? []), option]);
  return {
    ...assessment,
    questions: links.map((link) => ({
      ...link,
      question: questionMap.get(link.questionId),
      options: optionMap.get(link.questionId) ?? [],
    })),
  };
}

export async function createAssessment(input: {
  name: string;
  description?: string;
  subjectId: number;
  startDate?: Date;
  endDate?: Date;
  timeLimit: number;
  maxScore: number;
  allowSingleAttempt: boolean;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showResultImmediately: boolean;
  allowReview: boolean;
  questionIds: number[];
  createdBy?: number;
}) {
  const db = requireDb();
  const result = await db.insert(assessments).values({
    name: input.name,
    description: input.description || null,
    subjectId: input.subjectId,
    startDate: input.startDate || null,
    endDate: input.endDate || null,
    timeLimit: input.timeLimit,
    maxScore: input.maxScore,
    allowSingleAttempt: input.allowSingleAttempt,
    shuffleQuestions: input.shuffleQuestions,
    shuffleOptions: input.shuffleOptions,
    showResultImmediately: input.showResultImmediately,
    allowReview: input.allowReview,
    createdBy: input.createdBy || null,
  }).returning({ id: assessments.id });
  const assessmentId = result[0].id;
  if (input.questionIds.length) {
    await db.insert(assessmentQuestions).values(input.questionIds.map((questionId, index) => ({ assessmentId, questionId, questionOrder: index + 1, points: 1 })));
  }
  return assessmentId;
}

export async function publishAssessment(id: number) {
  await requireDb().update(assessments).set({ status: "published" }).where(eq(assessments.id, id));
}

export async function startAttempt(input: { assessmentId: number; schoolId: number; classId: number; cpf: string }) {
  const db = requireDb();
  const student = (await db.select().from(students).where(and(eq(students.schoolId, input.schoolId), eq(students.classId, input.classId), eq(students.cpf, normalizeCpf(input.cpf)), eq(students.status, "active"))).limit(1))[0];
  if (!student) throw new Error("Aluno não encontrado para a escola, turma e CPF informados");
  const assessment = (await db.select().from(assessments).where(eq(assessments.id, input.assessmentId)).limit(1))[0];
  if (!assessment || assessment.status !== "published") throw new Error("Avaliação indisponível");
  const now = new Date();
  if ((assessment.startDate && now < assessment.startDate) || (assessment.endDate && now > assessment.endDate)) throw new Error("Avaliação fora do período de aplicação");
  const existing = (await db.select().from(attempts).where(and(eq(attempts.assessmentId, assessment.id), eq(attempts.studentId, student.id))).limit(1))[0];
  if (existing && assessment.allowSingleAttempt) {
    if (existing.status === "submitted" || existing.status === "expired") throw new Error("Você já realizou esta avaliação");
    return existing;
  }
  const result = await db.insert(attempts).values({ assessmentId: assessment.id, studentId: student.id }).returning();
  return result[0];
}

export async function getAttempt(id: number) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, id)).limit(1))[0];
  if (!attempt) return undefined;
  const assessment = (await getAssessmentWithQuestions(attempt.assessmentId));
  const student = (await db.select().from(students).where(eq(students.id, attempt.studentId)).limit(1))[0];
  const savedAnswers = await db.select().from(answers).where(eq(answers.attemptId, id));
  return { attempt, assessment, student: student ? { ...student, cpf: maskCpf(student.cpf) } : undefined, savedAnswers };
}

export async function saveAnswer(input: { attemptId: number; questionId: number; selectedAnswer?: string | null }) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, input.attemptId)).limit(1))[0];
  if (!attempt || attempt.status !== "in_progress") throw new Error("Tentativa não está disponível");
  const question = (await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1))[0];
  if (!question) throw new Error("Questão não encontrada");
  await db.insert(answers).values({ attemptId: input.attemptId, questionId: input.questionId, selectedAnswer: input.selectedAnswer || null, correctAnswer: question.correctAnswer, isCorrect: false, points: 0 }).onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { selectedAnswer: input.selectedAnswer || null, answeredAt: new Date() } });
}

export async function submitAttempt(id: number, forceExpired = false) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, id)).limit(1))[0];
  if (!attempt || attempt.status !== "in_progress") throw new Error("Tentativa não está disponível");
  const assessment = await getAssessmentWithQuestions(attempt.assessmentId);
  if (!assessment) throw new Error("Avaliação não encontrada");
  const answerRows = await db.select().from(answers).where(eq(answers.attemptId, id));
  const answerMap = new Map(answerRows.map((answer) => [answer.questionId, answer]));
  const evaluationItems = assessment.questions.filter((item) => item.question).map((item) => ({ expected: item.question!.correctAnswer, selected: answerMap.get(item.question!.id)?.selectedAnswer, points: item.points || item.question!.points || 1 }));
  const result = calculateObjectiveResult(evaluationItems);
  for (const item of assessment.questions) {
    if (!item.question) continue;
    const questionPoints = item.points || item.question.points || 1;
    const answer = answerMap.get(item.question.id);
    const selected = answer?.selectedAnswer?.trim().toLowerCase() ?? "";
    const expected = item.question.correctAnswer.trim().toLowerCase();
    const isCorrect = selected !== "" && selected === expected;
    if (answer) {
      await db.update(answers).set({ isCorrect, points: isCorrect ? questionPoints : 0 }).where(eq(answers.id, answer.id));
    } else {
      await db.insert(answers).values({ attemptId: id, questionId: item.question.id, selectedAnswer: null, correctAnswer: item.question.correctAnswer, isCorrect: false, points: 0 });
    }
  }
  const totalQuestions = result.totalQuestions;
  const percentage = result.percentage;
  const score = (percentage / 100) * Number(assessment.maxScore || 10);
  await db.update(attempts).set({ status: forceExpired ? "expired" : "submitted", finishedAt: new Date(), correctAnswers: result.correctAnswers, wrongAnswers: result.wrongAnswers, score: score.toFixed(2), percentage: percentage.toFixed(2) }).where(eq(attempts.id, id));
  return { correctAnswers: result.correctAnswers, wrongAnswers: result.wrongAnswers, percentage: Number(percentage.toFixed(2)), score: Number(score.toFixed(2)), totalQuestions };
}

export async function getDashboardData(userId?: number, isAdmin = false) {
  const db = requireDb();
  const [schoolRows, studentRows, assessmentRows, attemptRows, subjectRows, classRows] = await Promise.all([
    db.select().from(schools),
    listStudents({ userId, isAdmin }),
    db.select().from(assessments),
    db.select().from(attempts),
    db.select().from(subjects),
    listClasses(userId, isAdmin),
  ]);
  const visibleClassIds = new Set(classRows.map((row) => row.id));
  const visibleStudents = studentRows;
  const visibleAttempts = userId && !isAdmin ? attemptRows.filter((attempt) => visibleStudents.some((student) => student.id === attempt.studentId)) : attemptRows;
  const completed = visibleAttempts.filter((attempt) => attempt.status !== "in_progress");
  const visibleSchoolIds = userId && !isAdmin ? new Set(visibleStudents.map((student) => student.schoolId)) : null;
  const visibleAssessmentIds = userId && !isAdmin ? new Set(visibleAttempts.map((attempt) => attempt.assessmentId)) : null;
  const visibleSchools = visibleSchoolIds ? schoolRows.filter((school) => visibleSchoolIds.has(school.id)) : schoolRows;
  const visibleAssessments = visibleAssessmentIds ? assessmentRows.filter((assessment) => visibleAssessmentIds.has(assessment.id)) : assessmentRows;
  const average = completed.length ? completed.reduce((sum, attempt) => sum + Number(attempt.percentage), 0) / completed.length : 0;
  const participation = visibleStudents.length ? (new Set(visibleAttempts.map((attempt) => attempt.studentId)).size / visibleStudents.length) * 100 : 0;
  const subjectMap = new Map(subjectRows.map((subject) => [subject.id, subject.name]));
  const assessmentMap = new Map(visibleAssessments.map((assessment) => [assessment.id, assessment.subjectId]));
  const bySubject = subjectRows.map((subject) => {
    const rows = completed.filter((attempt) => assessmentMap.get(attempt.assessmentId) === subject.id);
    return { subject: subject.name, value: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.percentage), 0) / rows.length) : 0 };
  });
  const byRange = [
    { label: "90–100%", value: completed.filter((row) => Number(row.percentage) >= 90).length },
    { label: "70–89%", value: completed.filter((row) => Number(row.percentage) >= 70 && Number(row.percentage) < 90).length },
    { label: "50–69%", value: completed.filter((row) => Number(row.percentage) >= 50 && Number(row.percentage) < 70).length },
    { label: "0–49%", value: completed.filter((row) => Number(row.percentage) < 50).length },
  ];
  return {
    totals: { schools: visibleSchools.length, students: visibleStudents.length, assessments: visibleAssessments.length, average: Math.round(average * 10) / 10, participation: Math.round(participation * 10) / 10 },
    bySubject,
    byRange,
    classes: classRows.map((classRow) => {
      const classStudentIds = new Set(visibleStudents.filter((student) => student.classId === classRow.id).map((student) => student.id));
      const rows = completed.filter((attempt) => classStudentIds.has(attempt.studentId));
      return { classId: classRow.id, label: classRow.name, value: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.percentage), 0) / rows.length) : 0 };
    }),
    subjectMap,
    visibleClassIds,
  };
}

export type ResultFilters = { schoolId?: number; classId?: number; assessmentId?: number; subjectId?: number; teacherId?: number; skill?: string; search?: string; minPercentage?: number; maxPercentage?: number; from?: Date; to?: Date };

export async function listResults(filters: ResultFilters, userId?: number, isAdmin = false) {
  const db = requireDb();
  const [attemptRows, studentRows, classRows, teacherRows, schoolRows, assessmentRows, subjectRows] = await Promise.all([
    db.select().from(attempts).where(or(eq(attempts.status, "submitted"), eq(attempts.status, "expired"))),
    db.select().from(students),
    db.select().from(classes),
    db.select().from(teachers),
    db.select().from(schools),
    db.select().from(assessments),
    db.select().from(subjects),
  ]);
  const teacherClassIds = userId && !isAdmin ? new Set(await getTeacherClassIds(userId)) : null;
  const skillAttemptIds = filters.skill ? new Set((await db.select({ attemptId: answers.attemptId }).from(answers).innerJoin(questions, eq(answers.questionId, questions.id)).where(like(questions.skill, `%${filters.skill}%`))).map((row) => row.attemptId)) : null;
  const studentMap = new Map(studentRows.map((row) => [row.id, row]));
  const classMap = new Map(classRows.map((row) => [row.id, row]));
  const teacherMap = new Map(teacherRows.map((row) => [row.id, row]));
  const schoolMap = new Map(schoolRows.map((row) => [row.id, row]));
  const assessmentMap = new Map(assessmentRows.map((row) => [row.id, row]));
  const subjectMap = new Map(subjectRows.map((row) => [row.id, row]));
  return attemptRows.map((attempt) => {
    const student = studentMap.get(attempt.studentId);
    const classRow = student ? classMap.get(student.classId) : undefined;
    const teacher = classRow ? teacherMap.get(classRow.teacherId) : undefined;
    const school = student ? schoolMap.get(student.schoolId) : undefined;
    const assessment = assessmentMap.get(attempt.assessmentId);
    const subject = assessment ? subjectMap.get(assessment.subjectId) : undefined;
    return { attempt, student, classRow, teacher, school, assessment, subject };
  }).filter((row) => {
    const percentage = Number(row.attempt.percentage);
    if (!row.student || !row.classRow || !row.assessment || !row.subject) return false;
    if (teacherClassIds && !teacherClassIds.has(row.classRow.id)) return false;
    if (filters.schoolId && row.student.schoolId !== filters.schoolId) return false;
    if (filters.classId && row.student.classId !== filters.classId) return false;
    if (filters.assessmentId && row.assessment.id !== filters.assessmentId) return false;
    if (filters.subjectId && row.subject.id !== filters.subjectId) return false;
    if (filters.teacherId && row.classRow.teacherId !== filters.teacherId) return false;
    if (skillAttemptIds && !skillAttemptIds.has(row.attempt.id)) return false;
    if (filters.search && !row.student.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.minPercentage !== undefined && percentage < filters.minPercentage) return false;
    if (filters.maxPercentage !== undefined && percentage > filters.maxPercentage) return false;
    if (filters.from && row.attempt.finishedAt && row.attempt.finishedAt < filters.from) return false;
    if (filters.to && row.attempt.finishedAt && row.attempt.finishedAt > filters.to) return false;
    return true;
  }).sort((a, b) => Number(b.attempt.percentage) - Number(a.attempt.percentage));
}

export type ReportType = "general" | "class" | "student";

export async function listIndividualReports(filters: ResultFilters, userId?: number, isAdmin = false) {
  const rows = await listResults(filters, userId, isAdmin);
  const grouped = new Map<number, { aluno: string; cpf: string; escola: string; turma: string; professor: string; total: number; sum: number; best: number; latest: Date | null }>();
  for (const row of rows) {
    if (!row.student) continue;
    const current = grouped.get(row.student.id) ?? { aluno: row.student.name, cpf: maskCpf(row.student.cpf), escola: row.school?.name ?? "", turma: row.classRow?.name ?? "", professor: row.teacher?.name ?? "", total: 0, sum: 0, best: 0, latest: null };
    const percentage = Number(row.attempt.percentage);
    current.total += 1;
    current.sum += percentage;
    current.best = Math.max(current.best, percentage);
    if (!current.latest || (row.attempt.finishedAt && row.attempt.finishedAt > current.latest)) current.latest = row.attempt.finishedAt;
    grouped.set(row.student.id, current);
  }
  return Array.from(grouped.values()).map((item) => ({ aluno: item.aluno, cpf: item.cpf, escola: item.escola, turma: item.turma, professor: item.professor, avaliacoesConcluidas: item.total, mediaPercentual: Number((item.sum / (item.total || 1)).toFixed(1)), melhorPercentual: Number(item.best.toFixed(1)), ultimaAvaliacao: item.latest ? item.latest.toLocaleDateString("pt-BR") : "—" })).sort((a, b) => b.mediaPercentual - a.mediaPercentual);
}

export async function listClassReports(filters: ResultFilters, userId?: number, isAdmin = false) {
  const rows = await listResults(filters, userId, isAdmin);
  const grouped = new Map<number, { turma: string; escola: string; professor: string; students: Set<number>; participants: Set<number>; attempts: number; sum: number; ranges: [number, number, number, number] }>();
  for (const row of rows) {
    if (!row.classRow) continue;
    const current = grouped.get(row.classRow.id) ?? { turma: row.classRow.name, escola: row.school?.name ?? "", professor: row.teacher?.name ?? "", students: new Set<number>(), participants: new Set<number>(), attempts: 0, sum: 0, ranges: [0, 0, 0, 0] };
    const percentage = Number(row.attempt.percentage);
    if (row.student) { current.students.add(row.student.id); current.participants.add(row.student.id); }
    current.attempts += 1;
    current.sum += percentage;
    current.ranges[percentage >= 90 ? 0 : percentage >= 70 ? 1 : percentage >= 50 ? 2 : 3] += 1;
    grouped.set(row.classRow.id, current);
  }
  const allStudents = await listStudents({ userId, isAdmin });
  return Array.from(grouped.entries()).map(([classId, item]) => ({ classId, turma: item.turma, escola: item.escola, professor: item.professor, alunos: allStudents.filter((student) => student.classId === classId).length, participantes: item.participants.size, tentativas: item.attempts, participacaoPercentual: item.students.size ? Number(((item.participants.size / item.students.size) * 100).toFixed(1)) : 0, mediaPercentual: Number((item.sum / (item.attempts || 1)).toFixed(1)), faixa90a100: item.ranges[0], faixa70a89: item.ranges[1], faixa50a69: item.ranges[2], faixa0a49: item.ranges[3] })).sort((a, b) => b.mediaPercentual - a.mediaPercentual);
}

export async function getClassSummary(classId: number, userId?: number, isAdmin = false) {
  const [classRows, students, rows] = await Promise.all([listClasses(userId, isAdmin), listStudents({ userId, isAdmin }), listResults({ classId }, userId, isAdmin)]);
  const classRow = classRows.find((item) => item.id === classId);
  if (!classRow) throw new Error("Turma não encontrada ou sem permissão");
  const classStudents = students.filter((student) => student.classId === classId);
  const uniqueStudents = new Set(rows.map((row) => row.student?.id).filter((id): id is number => Boolean(id)));
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.attempt.percentage), 0) / rows.length : 0;
  const distribution = [
    { label: "90–100%", value: rows.filter((row) => Number(row.attempt.percentage) >= 90).length },
    { label: "70–89%", value: rows.filter((row) => Number(row.attempt.percentage) >= 70 && Number(row.attempt.percentage) < 90).length },
    { label: "50–69%", value: rows.filter((row) => Number(row.attempt.percentage) >= 50 && Number(row.attempt.percentage) < 70).length },
    { label: "0–49%", value: rows.filter((row) => Number(row.attempt.percentage) < 50).length },
  ];
  const assessmentMap = new Map<number, { name: string; total: number; sum: number }>();
  for (const row of rows) {
    const current = assessmentMap.get(row.assessment!.id) ?? { name: row.assessment!.name, total: 0, sum: 0 };
    current.total += 1;
    current.sum += Number(row.attempt.percentage);
    assessmentMap.set(row.assessment!.id, current);
  }
  const evolution = Array.from(assessmentMap.values()).map((item) => ({ name: item.name, percentage: Math.round((item.sum / item.total) * 10) / 10, attempts: item.total }));
  return { classRow, totalStudents: classStudents.length, participation: classStudents.length ? Math.round((uniqueStudents.size / classStudents.length) * 1000) / 10 : 0, average: Math.round(average * 10) / 10, completedAttempts: rows.length, distribution, evolution };
}

export async function getStudentResult(studentId: number, userId?: number, isAdmin = false) {
  const studentRows = await listStudents({ userId, isAdmin });
  const student = studentRows.find((row) => row.id === studentId);
  if (!student) throw new Error("Aluno não encontrado ou sem permissão");
  const rows = await listResults({}, userId, isAdmin);
  const results = rows.filter((row) => row.student?.id === studentId);
  return { student: { ...student, cpf: maskCpf(student.cpf) }, results };
}

export async function addAuditLog(input: { userId?: number; action: string; tableName: string; recordId?: number }) {
  await requireDb().insert(auditLogs).values({ userId: input.userId || null, action: input.action, tableName: input.tableName, recordId: input.recordId || null });
}

export async function getQuestionAnalysis(userId?: number, isAdmin = false) {
  const db = requireDb();
  const visibleResults = await listResults({}, userId, isAdmin);
  const attemptIds = visibleResults.map((row) => row.attempt.id);
  if (!attemptIds.length) return [];
  const answerRows = await db.select().from(answers).where(inArray(answers.attemptId, attemptIds));
  const questionIds = Array.from(new Set(answerRows.map((row) => row.questionId)));
  if (!questionIds.length) return [];
  const questionRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const questionMap = new Map(questionRows.map((question) => [question.id, question]));
  const stats = new Map<number, { total: number; correct: number }>();
  for (const answer of answerRows) {
    const current = stats.get(answer.questionId) ?? { total: 0, correct: 0 };
    current.total += 1;
    if (answer.isCorrect) current.correct += 1;
    stats.set(answer.questionId, current);
  }
  return Array.from(stats.entries()).map(([questionId, stat]) => {
    const question = questionMap.get(questionId);
    const percentage = stat.total ? Math.round((stat.correct / stat.total) * 100) : 0;
    return {
      questionId,
      statement: question?.statement ?? "",
      skill: question?.skill ?? "Não classificada",
      descriptor: question?.descriptor ?? "—",
      difficulty: question?.difficulty ?? "medium",
      correct: stat.correct,
      total: stat.total,
      percentage,
    };
  }).sort((a, b) => a.percentage - b.percentage);
}
