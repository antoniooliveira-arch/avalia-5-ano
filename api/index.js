// server/app.ts
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, asc, desc, eq, inArray, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// drizzle/schema.ts
import {
  boolean,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var userRoleEnum = pgEnum("user_role", ["user", "admin", "teacher"]);
var userStatusEnum = pgEnum("user_status", ["active", "blocked"]);
var activeStatusEnum = pgEnum("active_status", ["active", "inactive"]);
var questionTypeEnum = pgEnum("question_type", ["multiple_choice", "true_false", "short_answer"]);
var difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
var optionLabelEnum = pgEnum("option_label", ["A", "B", "C", "D", "E"]);
var assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "closed"]);
var attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted", "expired"]);
var users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("user").notNull(),
    status: userStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => /* @__PURE__ */ new Date()).notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email)
  })
);
var schools = pgTable(
  "schools",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    codeUnique: uniqueIndex("schools_code_unique").on(table.code),
    nameIdx: index("schools_name_idx").on(table.name)
  })
);
var teachers = pgTable(
  "teachers",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    schoolId: integer("schoolId").notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    email: varchar("email", { length: 320 }),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    userIdx: uniqueIndex("teachers_user_unique").on(table.userId),
    schoolIdx: index("teachers_school_idx").on(table.schoolId),
    cpfIdx: index("teachers_cpf_idx").on(table.cpf)
  })
);
var classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    grade: varchar("grade", { length: 32 }).default("5\xBA Ano").notNull(),
    schoolId: integer("schoolId").notNull(),
    teacherId: integer("teacherId").notNull(),
    year: integer("year").notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    schoolIdx: index("classes_school_idx").on(table.schoolId),
    teacherIdx: index("classes_teacher_idx").on(table.teacherId),
    yearIdx: index("classes_year_idx").on(table.year)
  })
);
var students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    schoolId: integer("schoolId").notNull(),
    classId: integer("classId").notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    schoolIdx: index("students_school_idx").on(table.schoolId),
    classIdx: index("students_class_idx").on(table.classId),
    cpfIdx: index("students_cpf_idx").on(table.cpf)
  })
);
var subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    status: activeStatusEnum("status").default("active").notNull()
  },
  (table) => ({
    codeUnique: uniqueIndex("subjects_code_unique").on(table.code)
  })
);
var questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subjectId").notNull(),
    grade: varchar("grade", { length: 32 }).default("5\xBA Ano").notNull(),
    statement: text("statement").notNull(),
    questionType: questionTypeEnum("questionType").default("multiple_choice").notNull(),
    difficulty: difficultyEnum("difficulty").default("medium").notNull(),
    unitTheme: varchar("unitTheme", { length: 160 }),
    skill: varchar("skill", { length: 160 }),
    descriptor: varchar("descriptor", { length: 160 }),
    content: varchar("content", { length: 180 }),
    imageUrl: text("imageUrl"),
    correctAnswer: text("correctAnswer").notNull(),
    points: integer("points").default(1).notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    subjectIdx: index("questions_subject_idx").on(table.subjectId),
    difficultyIdx: index("questions_difficulty_idx").on(table.difficulty),
    skillIdx: index("questions_skill_idx").on(table.skill)
  })
);
var questionOptions = pgTable(
  "question_options",
  {
    id: serial("id").primaryKey(),
    questionId: integer("questionId").notNull(),
    optionLabel: optionLabelEnum("optionLabel").notNull(),
    optionText: text("optionText").notNull(),
    isCorrect: boolean("isCorrect").default(false).notNull()
  },
  (table) => ({
    questionIdx: index("question_options_question_idx").on(table.questionId)
  })
);
var assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    subjectId: integer("subjectId").notNull(),
    grade: varchar("grade", { length: 32 }).default("5\xBA Ano").notNull(),
    startDate: timestamp("startDate"),
    endDate: timestamp("endDate"),
    timeLimit: integer("timeLimit").default(60).notNull(),
    maxScore: integer("maxScore").default(10).notNull(),
    allowSingleAttempt: boolean("allowSingleAttempt").default(true).notNull(),
    shuffleQuestions: boolean("shuffleQuestions").default(false).notNull(),
    shuffleOptions: boolean("shuffleOptions").default(false).notNull(),
    showResultImmediately: boolean("showResultImmediately").default(true).notNull(),
    allowReview: boolean("allowReview").default(true).notNull(),
    status: assessmentStatusEnum("status").default("draft").notNull(),
    createdBy: integer("createdBy"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    subjectIdx: index("assessments_subject_idx").on(table.subjectId),
    statusIdx: index("assessments_status_idx").on(table.status),
    dateIdx: index("assessments_start_date_idx").on(table.startDate)
  })
);
var assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessmentId").notNull(),
    questionId: integer("questionId").notNull(),
    questionOrder: integer("questionOrder").notNull(),
    points: integer("points").default(1).notNull()
  },
  (table) => ({
    assessmentIdx: index("assessment_questions_assessment_idx").on(table.assessmentId),
    questionIdx: index("assessment_questions_question_idx").on(table.questionId),
    uniqueQuestion: uniqueIndex("assessment_questions_unique").on(table.assessmentId, table.questionId)
  })
);
var attempts = pgTable(
  "attempts",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessmentId").notNull(),
    studentId: integer("studentId").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    finishedAt: timestamp("finishedAt"),
    score: decimal("score", { precision: 6, scale: 2 }).default("0").notNull(),
    correctAnswers: integer("correctAnswers").default(0).notNull(),
    wrongAnswers: integer("wrongAnswers").default(0).notNull(),
    percentage: decimal("percentage", { precision: 5, scale: 2 }).default("0").notNull(),
    status: attemptStatusEnum("status").default("in_progress").notNull()
  },
  (table) => ({
    assessmentIdx: index("attempts_assessment_idx").on(table.assessmentId),
    studentIdx: index("attempts_student_idx").on(table.studentId),
    statusIdx: index("attempts_status_idx").on(table.status),
    uniqueAttempt: uniqueIndex("attempts_single_unique").on(table.assessmentId, table.studentId)
  })
);
var answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attemptId").notNull(),
    questionId: integer("questionId").notNull(),
    selectedAnswer: text("selectedAnswer"),
    correctAnswer: text("correctAnswer").notNull(),
    isCorrect: boolean("isCorrect").default(false).notNull(),
    points: integer("points").default(0).notNull(),
    answeredAt: timestamp("answeredAt").defaultNow().notNull()
  },
  (table) => ({
    attemptIdx: index("answers_attempt_idx").on(table.attemptId),
    questionIdx: index("answers_question_idx").on(table.questionId),
    uniqueAnswer: uniqueIndex("answers_attempt_question_unique").on(table.attemptId, table.questionId)
  })
);
var auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    action: varchar("action", { length: 80 }).notNull(),
    tableName: varchar("tableName", { length: 80 }).notNull(),
    recordId: integer("recordId"),
    createdAt: timestamp("createdAt").defaultNow().notNull()
  },
  (table) => ({
    userIdx: index("audit_logs_user_idx").on(table.userId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt)
  })
);

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/assessment-utils.ts
function calculateObjectiveResult(items) {
  const totalQuestions = items.length;
  const totalPoints = items.reduce((sum, item) => sum + (item.points ?? 1), 0);
  const correctAnswers = items.reduce((sum, item) => {
    const selected = item.selected?.trim().toLowerCase() ?? "";
    return sum + (selected !== "" && selected === item.expected.trim().toLowerCase() ? 1 : 0);
  }, 0);
  const earnedPoints = items.reduce((sum, item) => {
    const selected = item.selected?.trim().toLowerCase() ?? "";
    const isCorrect = selected !== "" && selected === item.expected.trim().toLowerCase();
    return sum + (isCorrect ? item.points ?? 1 : 0);
  }, 0);
  const wrongAnswers = Math.max(totalQuestions - correctAnswers, 0);
  const percentage = totalPoints ? Number((earnedPoints / totalPoints * 100).toFixed(2)) : 0;
  return { totalQuestions, totalPoints, earnedPoints, correctAnswers, wrongAnswers, percentage };
}

// server/db.ts
var _db = null;
async function getDb() {
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
function normalizeCpf(cpf) {
  return cpf.replace(/\D/g, "");
}
function maskCpf(cpf) {
  const digits = normalizeCpf(cpf ?? "");
  if (digits.length !== 11) return "\u2022\u2022\u2022.\u2022\u2022\u2022.\u2022\u2022\u2022-\u2022\u2022";
  return `${digits.slice(0, 3)}.\u2022\u2022\u2022.\u2022\u2022\u2022-${digits.slice(-2)}`;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }
  const values = { openId: user.openId };
  const updateSet = {};
  const textFields = ["name", "email", "loginMethod"];
  for (const field of textFields) {
    if (user[field] !== void 0) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = /* @__PURE__ */ new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function getTeacherForUser(userId) {
  const db = requireDb();
  const result = await db.select().from(teachers).where(eq(teachers.userId, userId)).limit(1);
  return result[0];
}
async function getTeacherClassIds(userId) {
  const teacher = await getTeacherForUser(userId);
  if (!teacher) return [];
  const db = requireDb();
  const rows = await db.select({ id: classes.id }).from(classes).where(eq(classes.teacherId, teacher.id));
  return rows.map((row) => row.id);
}
async function listSchools() {
  return requireDb().select().from(schools).orderBy(asc(schools.name));
}
async function createSchool(input) {
  const db = requireDb();
  const result = await db.insert(schools).values({ name: input.name, code: input.code.toUpperCase() }).returning({ id: schools.id });
  return result[0].id;
}
async function updateSchool(id, input) {
  await requireDb().update(schools).set({ ...input, code: input.code?.toUpperCase() }).where(eq(schools.id, id));
}
async function listTeachers(userId, isAdmin = false) {
  const db = requireDb();
  if (userId && !isAdmin) {
    return db.select().from(teachers).where(eq(teachers.userId, userId)).orderBy(asc(teachers.name));
  }
  return db.select().from(teachers).orderBy(asc(teachers.name));
}
async function createTeacher(input) {
  const db = requireDb();
  const result = await db.insert(teachers).values({
    name: input.name,
    cpf: normalizeCpf(input.cpf),
    email: input.email || null,
    schoolId: input.schoolId,
    userId: input.userId || null
  }).returning({ id: teachers.id });
  return result[0].id;
}
async function updateTeacher(id, input) {
  await requireDb().update(teachers).set({ ...input, cpf: input.cpf ? normalizeCpf(input.cpf) : void 0 }).where(eq(teachers.id, id));
}
async function listClasses(userId, isAdmin = false) {
  const db = requireDb();
  if (userId && !isAdmin) {
    const teacher = await getTeacherForUser(userId);
    if (!teacher) return [];
    return db.select().from(classes).where(eq(classes.teacherId, teacher.id)).orderBy(desc(classes.year), asc(classes.name));
  }
  return db.select().from(classes).orderBy(desc(classes.year), asc(classes.name));
}
async function createClass(input) {
  const result = await requireDb().insert(classes).values(input).returning({ id: classes.id });
  return result[0].id;
}
async function updateClass(id, input) {
  await requireDb().update(classes).set(input).where(eq(classes.id, id));
}
async function listStudents(options) {
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
  return db.select().from(students).where(conditions.length ? and(...conditions) : void 0).orderBy(asc(students.name));
}
async function createStudent(input) {
  const result = await requireDb().insert(students).values({ ...input, cpf: normalizeCpf(input.cpf) }).returning({ id: students.id });
  return result[0].id;
}
async function updateStudent(id, input) {
  await requireDb().update(students).set({ ...input, cpf: input.cpf ? normalizeCpf(input.cpf) : void 0 }).where(eq(students.id, id));
}
async function listSubjects(includeInactive = false) {
  return requireDb().select().from(subjects).where(includeInactive ? void 0 : eq(subjects.status, "active")).orderBy(asc(subjects.name));
}
async function createSubject(input) {
  const result = await requireDb().insert(subjects).values(input).returning({ id: subjects.id });
  return result[0].id;
}
async function updateSubject(id, input) {
  await requireDb().update(subjects).set(input).where(eq(subjects.id, id));
}
async function listQuestions(options) {
  const db = requireDb();
  const conditions = [eq(questions.status, "active")];
  if (options.subjectId) conditions.push(eq(questions.subjectId, options.subjectId));
  if (options.search) conditions.push(like(questions.statement, `%${options.search}%`));
  return db.select().from(questions).where(and(...conditions)).orderBy(desc(questions.createdAt));
}
async function getQuestionWithOptions(id) {
  const db = requireDb();
  const question = (await db.select().from(questions).where(eq(questions.id, id)).limit(1))[0];
  if (!question) return void 0;
  const options = await db.select().from(questionOptions).where(eq(questionOptions.questionId, id)).orderBy(asc(questionOptions.id));
  return { ...question, options };
}
async function createQuestion(input) {
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
    points: input.points
  }).returning({ id: questions.id });
  const questionId = result[0].id;
  if (input.options.length) {
    await db.insert(questionOptions).values(input.options.map((option) => ({ ...option, questionId })));
  }
  return questionId;
}
async function listAssessments() {
  return requireDb().select().from(assessments).orderBy(desc(assessments.createdAt));
}
async function getAssessmentWithQuestions(id) {
  const db = requireDb();
  const assessment = (await db.select().from(assessments).where(eq(assessments.id, id)).limit(1))[0];
  if (!assessment) return void 0;
  const links = await db.select().from(assessmentQuestions).where(eq(assessmentQuestions.assessmentId, id)).orderBy(asc(assessmentQuestions.questionOrder));
  const questionIds = links.map((link) => link.questionId);
  const questionRows = questionIds.length ? await db.select().from(questions).where(inArray(questions.id, questionIds)) : [];
  const optionRows = questionIds.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, questionIds)) : [];
  const questionMap = new Map(questionRows.map((question) => [question.id, question]));
  const optionMap = /* @__PURE__ */ new Map();
  for (const option of optionRows) optionMap.set(option.questionId, [...optionMap.get(option.questionId) ?? [], option]);
  return {
    ...assessment,
    questions: links.map((link) => ({
      ...link,
      question: questionMap.get(link.questionId),
      options: optionMap.get(link.questionId) ?? []
    }))
  };
}
async function createAssessment(input) {
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
    createdBy: input.createdBy || null
  }).returning({ id: assessments.id });
  const assessmentId = result[0].id;
  if (input.questionIds.length) {
    await db.insert(assessmentQuestions).values(input.questionIds.map((questionId, index2) => ({ assessmentId, questionId, questionOrder: index2 + 1, points: 1 })));
  }
  return assessmentId;
}
async function publishAssessment(id) {
  await requireDb().update(assessments).set({ status: "published" }).where(eq(assessments.id, id));
}
async function startAttempt(input) {
  const db = requireDb();
  const student = (await db.select().from(students).where(and(eq(students.schoolId, input.schoolId), eq(students.classId, input.classId), eq(students.cpf, normalizeCpf(input.cpf)), eq(students.status, "active"))).limit(1))[0];
  if (!student) throw new Error("Aluno n\xE3o encontrado para a escola, turma e CPF informados");
  const assessment = (await db.select().from(assessments).where(eq(assessments.id, input.assessmentId)).limit(1))[0];
  if (!assessment || assessment.status !== "published") throw new Error("Avalia\xE7\xE3o indispon\xEDvel");
  const now = /* @__PURE__ */ new Date();
  if (assessment.startDate && now < assessment.startDate || assessment.endDate && now > assessment.endDate) throw new Error("Avalia\xE7\xE3o fora do per\xEDodo de aplica\xE7\xE3o");
  const existing = (await db.select().from(attempts).where(and(eq(attempts.assessmentId, assessment.id), eq(attempts.studentId, student.id))).limit(1))[0];
  if (existing && assessment.allowSingleAttempt) {
    if (existing.status === "submitted" || existing.status === "expired") throw new Error("Voc\xEA j\xE1 realizou esta avalia\xE7\xE3o");
    return existing;
  }
  const result = await db.insert(attempts).values({ assessmentId: assessment.id, studentId: student.id }).returning();
  return result[0];
}
async function getAttempt(id) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, id)).limit(1))[0];
  if (!attempt) return void 0;
  const assessment = await getAssessmentWithQuestions(attempt.assessmentId);
  const student = (await db.select().from(students).where(eq(students.id, attempt.studentId)).limit(1))[0];
  const savedAnswers = await db.select().from(answers).where(eq(answers.attemptId, id));
  return { attempt, assessment, student: student ? { ...student, cpf: maskCpf(student.cpf) } : void 0, savedAnswers };
}
async function saveAnswer(input) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, input.attemptId)).limit(1))[0];
  if (!attempt || attempt.status !== "in_progress") throw new Error("Tentativa n\xE3o est\xE1 dispon\xEDvel");
  const question = (await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1))[0];
  if (!question) throw new Error("Quest\xE3o n\xE3o encontrada");
  await db.insert(answers).values({ attemptId: input.attemptId, questionId: input.questionId, selectedAnswer: input.selectedAnswer || null, correctAnswer: question.correctAnswer, isCorrect: false, points: 0 }).onConflictDoUpdate({ target: [answers.attemptId, answers.questionId], set: { selectedAnswer: input.selectedAnswer || null, answeredAt: /* @__PURE__ */ new Date() } });
}
async function submitAttempt(id, forceExpired = false) {
  const db = requireDb();
  const attempt = (await db.select().from(attempts).where(eq(attempts.id, id)).limit(1))[0];
  if (!attempt || attempt.status !== "in_progress") throw new Error("Tentativa n\xE3o est\xE1 dispon\xEDvel");
  const assessment = await getAssessmentWithQuestions(attempt.assessmentId);
  if (!assessment) throw new Error("Avalia\xE7\xE3o n\xE3o encontrada");
  const answerRows = await db.select().from(answers).where(eq(answers.attemptId, id));
  const answerMap = new Map(answerRows.map((answer) => [answer.questionId, answer]));
  const evaluationItems = assessment.questions.filter((item) => item.question).map((item) => ({ expected: item.question.correctAnswer, selected: answerMap.get(item.question.id)?.selectedAnswer, points: item.points || item.question.points || 1 }));
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
  const score = percentage / 100 * Number(assessment.maxScore || 10);
  await db.update(attempts).set({ status: forceExpired ? "expired" : "submitted", finishedAt: /* @__PURE__ */ new Date(), correctAnswers: result.correctAnswers, wrongAnswers: result.wrongAnswers, score: score.toFixed(2), percentage: percentage.toFixed(2) }).where(eq(attempts.id, id));
  return { correctAnswers: result.correctAnswers, wrongAnswers: result.wrongAnswers, percentage: Number(percentage.toFixed(2)), score: Number(score.toFixed(2)), totalQuestions };
}
async function getDashboardData(userId, isAdmin = false) {
  const db = requireDb();
  const [schoolRows, studentRows, assessmentRows, attemptRows, subjectRows, classRows] = await Promise.all([
    db.select().from(schools),
    listStudents({ userId, isAdmin }),
    db.select().from(assessments),
    db.select().from(attempts),
    db.select().from(subjects),
    listClasses(userId, isAdmin)
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
  const participation = visibleStudents.length ? new Set(visibleAttempts.map((attempt) => attempt.studentId)).size / visibleStudents.length * 100 : 0;
  const subjectMap = new Map(subjectRows.map((subject) => [subject.id, subject.name]));
  const assessmentMap = new Map(visibleAssessments.map((assessment) => [assessment.id, assessment.subjectId]));
  const bySubject = subjectRows.map((subject) => {
    const rows = completed.filter((attempt) => assessmentMap.get(attempt.assessmentId) === subject.id);
    return { subject: subject.name, value: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.percentage), 0) / rows.length) : 0 };
  });
  const byRange = [
    { label: "90\u2013100%", value: completed.filter((row) => Number(row.percentage) >= 90).length },
    { label: "70\u201389%", value: completed.filter((row) => Number(row.percentage) >= 70 && Number(row.percentage) < 90).length },
    { label: "50\u201369%", value: completed.filter((row) => Number(row.percentage) >= 50 && Number(row.percentage) < 70).length },
    { label: "0\u201349%", value: completed.filter((row) => Number(row.percentage) < 50).length }
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
    visibleClassIds
  };
}
async function listResults(filters, userId, isAdmin = false) {
  const db = requireDb();
  const [attemptRows, studentRows, classRows, teacherRows, schoolRows, assessmentRows, subjectRows] = await Promise.all([
    db.select().from(attempts).where(or(eq(attempts.status, "submitted"), eq(attempts.status, "expired"))),
    db.select().from(students),
    db.select().from(classes),
    db.select().from(teachers),
    db.select().from(schools),
    db.select().from(assessments),
    db.select().from(subjects)
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
    const classRow = student ? classMap.get(student.classId) : void 0;
    const teacher = classRow ? teacherMap.get(classRow.teacherId) : void 0;
    const school = student ? schoolMap.get(student.schoolId) : void 0;
    const assessment = assessmentMap.get(attempt.assessmentId);
    const subject = assessment ? subjectMap.get(assessment.subjectId) : void 0;
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
    if (filters.minPercentage !== void 0 && percentage < filters.minPercentage) return false;
    if (filters.maxPercentage !== void 0 && percentage > filters.maxPercentage) return false;
    if (filters.from && row.attempt.finishedAt && row.attempt.finishedAt < filters.from) return false;
    if (filters.to && row.attempt.finishedAt && row.attempt.finishedAt > filters.to) return false;
    return true;
  }).sort((a, b) => Number(b.attempt.percentage) - Number(a.attempt.percentage));
}
async function listIndividualReports(filters, userId, isAdmin = false) {
  const rows = await listResults(filters, userId, isAdmin);
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row.student) continue;
    const current = grouped.get(row.student.id) ?? { aluno: row.student.name, cpf: maskCpf(row.student.cpf), escola: row.school?.name ?? "", turma: row.classRow?.name ?? "", professor: row.teacher?.name ?? "", total: 0, sum: 0, best: 0, latest: null };
    const percentage = Number(row.attempt.percentage);
    current.total += 1;
    current.sum += percentage;
    current.best = Math.max(current.best, percentage);
    if (!current.latest || row.attempt.finishedAt && row.attempt.finishedAt > current.latest) current.latest = row.attempt.finishedAt;
    grouped.set(row.student.id, current);
  }
  return Array.from(grouped.values()).map((item) => ({ aluno: item.aluno, cpf: item.cpf, escola: item.escola, turma: item.turma, professor: item.professor, avaliacoesConcluidas: item.total, mediaPercentual: Number((item.sum / (item.total || 1)).toFixed(1)), melhorPercentual: Number(item.best.toFixed(1)), ultimaAvaliacao: item.latest ? item.latest.toLocaleDateString("pt-BR") : "\u2014" })).sort((a, b) => b.mediaPercentual - a.mediaPercentual);
}
async function listClassReports(filters, userId, isAdmin = false) {
  const rows = await listResults(filters, userId, isAdmin);
  const grouped = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!row.classRow) continue;
    const current = grouped.get(row.classRow.id) ?? { turma: row.classRow.name, escola: row.school?.name ?? "", professor: row.teacher?.name ?? "", students: /* @__PURE__ */ new Set(), participants: /* @__PURE__ */ new Set(), attempts: 0, sum: 0, ranges: [0, 0, 0, 0] };
    const percentage = Number(row.attempt.percentage);
    if (row.student) {
      current.students.add(row.student.id);
      current.participants.add(row.student.id);
    }
    current.attempts += 1;
    current.sum += percentage;
    current.ranges[percentage >= 90 ? 0 : percentage >= 70 ? 1 : percentage >= 50 ? 2 : 3] += 1;
    grouped.set(row.classRow.id, current);
  }
  const allStudents = await listStudents({ userId, isAdmin });
  return Array.from(grouped.entries()).map(([classId, item]) => ({ classId, turma: item.turma, escola: item.escola, professor: item.professor, alunos: allStudents.filter((student) => student.classId === classId).length, participantes: item.participants.size, tentativas: item.attempts, participacaoPercentual: item.students.size ? Number((item.participants.size / item.students.size * 100).toFixed(1)) : 0, mediaPercentual: Number((item.sum / (item.attempts || 1)).toFixed(1)), faixa90a100: item.ranges[0], faixa70a89: item.ranges[1], faixa50a69: item.ranges[2], faixa0a49: item.ranges[3] })).sort((a, b) => b.mediaPercentual - a.mediaPercentual);
}
async function getClassSummary(classId, userId, isAdmin = false) {
  const [classRows, students2, rows] = await Promise.all([listClasses(userId, isAdmin), listStudents({ userId, isAdmin }), listResults({ classId }, userId, isAdmin)]);
  const classRow = classRows.find((item) => item.id === classId);
  if (!classRow) throw new Error("Turma n\xE3o encontrada ou sem permiss\xE3o");
  const classStudents = students2.filter((student) => student.classId === classId);
  const uniqueStudents = new Set(rows.map((row) => row.student?.id).filter((id) => Boolean(id)));
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.attempt.percentage), 0) / rows.length : 0;
  const distribution = [
    { label: "90\u2013100%", value: rows.filter((row) => Number(row.attempt.percentage) >= 90).length },
    { label: "70\u201389%", value: rows.filter((row) => Number(row.attempt.percentage) >= 70 && Number(row.attempt.percentage) < 90).length },
    { label: "50\u201369%", value: rows.filter((row) => Number(row.attempt.percentage) >= 50 && Number(row.attempt.percentage) < 70).length },
    { label: "0\u201349%", value: rows.filter((row) => Number(row.attempt.percentage) < 50).length }
  ];
  const assessmentMap = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = assessmentMap.get(row.assessment.id) ?? { name: row.assessment.name, total: 0, sum: 0 };
    current.total += 1;
    current.sum += Number(row.attempt.percentage);
    assessmentMap.set(row.assessment.id, current);
  }
  const evolution = Array.from(assessmentMap.values()).map((item) => ({ name: item.name, percentage: Math.round(item.sum / item.total * 10) / 10, attempts: item.total }));
  return { classRow, totalStudents: classStudents.length, participation: classStudents.length ? Math.round(uniqueStudents.size / classStudents.length * 1e3) / 10 : 0, average: Math.round(average * 10) / 10, completedAttempts: rows.length, distribution, evolution };
}
async function getStudentResult(studentId, userId, isAdmin = false) {
  const studentRows = await listStudents({ userId, isAdmin });
  const student = studentRows.find((row) => row.id === studentId);
  if (!student) throw new Error("Aluno n\xE3o encontrado ou sem permiss\xE3o");
  const rows = await listResults({}, userId, isAdmin);
  const results = rows.filter((row) => row.student?.id === studentId);
  return { student: { ...student, cpf: maskCpf(student.cpf) }, results };
}
async function addAuditLog(input) {
  await requireDb().insert(auditLogs).values({ userId: input.userId || null, action: input.action, tableName: input.tableName, recordId: input.recordId || null });
}
async function getQuestionAnalysis(userId, isAdmin = false) {
  const db = requireDb();
  const visibleResults = await listResults({}, userId, isAdmin);
  const attemptIds = visibleResults.map((row) => row.attempt.id);
  if (!attemptIds.length) return [];
  const answerRows = await db.select().from(answers).where(inArray(answers.attemptId, attemptIds));
  const questionIds = Array.from(new Set(answerRows.map((row) => row.questionId)));
  if (!questionIds.length) return [];
  const questionRows = await db.select().from(questions).where(inArray(questions.id, questionIds));
  const questionMap = new Map(questionRows.map((question) => [question.id, question]));
  const stats = /* @__PURE__ */ new Map();
  for (const answer of answerRows) {
    const current = stats.get(answer.questionId) ?? { total: 0, correct: 0 };
    current.total += 1;
    if (answer.isCorrect) current.correct += 1;
    stats.set(answer.questionId, current);
  }
  return Array.from(stats.entries()).map(([questionId, stat]) => {
    const question = questionMap.get(questionId);
    const percentage = stat.total ? Math.round(stat.correct / stat.total * 100) : 0;
    return {
      questionId,
      statement: question?.statement ?? "",
      skill: question?.skill ?? "N\xE3o classificada",
      descriptor: question?.descriptor ?? "\u2014",
      difficulty: question?.difficulty ?? "medium",
      correct: stat.correct,
      total: stat.total,
      percentage
    };
  }).sort((a, b) => a.percentage - b.percentage);
}

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: isSecureRequest(req)
  };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app2) {
  app2.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/storageProxy.ts
function registerStorageProxy(app2) {
  app2.get("/manus-storage/*", async (req, res) => {
    const key = req.params[0];
    if (!key) {
      res.status(400).send("Missing storage key");
      return;
    }
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      res.status(500).send("Storage proxy not configured");
      return;
    }
    try {
      const forgeUrl = new URL(
        "v1/storage/presign/get",
        ENV.forgeApiUrl.replace(/\/+$/, "") + "/"
      );
      forgeUrl.searchParams.set("path", key);
      const forgeResp = await fetch(forgeUrl, {
        headers: { Authorization: `Bearer ${ENV.forgeApiKey}` }
      });
      if (!forgeResp.ok) {
        const body = await forgeResp.text().catch(() => "");
        console.error(`[StorageProxy] forge error: ${forgeResp.status} ${body}`);
        res.status(502).send("Storage backend error");
        return;
      }
      const { url } = await forgeResp.json();
      if (!url) {
        res.status(502).send("Empty signed URL from backend");
        return;
      }
      res.set("Cache-Control", "no-store");
      res.redirect(307, url);
    } catch (err) {
      console.error("[StorageProxy] failed:", err);
      res.status(502).send("Storage proxy error");
    }
  });
}

// server/routers.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { z as z2 } from "zod";

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/notification.ts
import { TRPCError } from "@trpc/server";
var TITLE_MAX_LENGTH = 1200;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString2 = (value) => typeof value === "string" && value.trim().length > 0;
var buildEndpointUrl = (baseUrl) => {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(
    "webdevtoken.v1.WebDevService/SendNotification",
    normalizedBase
  ).toString();
};
var validatePayload = (input) => {
  if (!isNonEmptyString2(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString2(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  if (!ENV.forgeApiUrl) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service URL is not configured."
    });
  }
  if (!ENV.forgeApiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Notification service API key is not configured."
    });
  }
  const endpoint = buildEndpointUrl(ENV.forgeApiUrl);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${ENV.forgeApiKey}`,
        "content-type": "application/json",
        "connect-protocol-version": "1"
      },
      body: JSON.stringify({ title, content })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.warn(
        `[Notification] Failed to notify owner (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn("[Notification] Error calling notification service:", error);
    return false;
  }
}

// server/_core/trpc.ts
import { initTRPC, TRPCError as TRPCError2 } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError2({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError2({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z.object({
      title: z.string().min(1, "title is required"),
      content: z.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
var idInput = z2.object({ id: z2.number().int().positive() });
var statusInput = z2.enum(["active", "inactive"]);
var dateInput = z2.coerce.date().optional();
async function ensureStaff(user) {
  if (user.role === "admin") return true;
  if (user.role !== "teacher" && !await getTeacherForUser(user.id)) {
    throw new TRPCError3({ code: "FORBIDDEN", message: "Acesso dispon\xEDvel apenas para administradores e professores." });
  }
  return false;
}
async function withDatabaseError(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError3) throw error;
    const message = error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel concluir a opera\xE7\xE3o.";
    throw new TRPCError3({ code: "BAD_REQUEST", message });
  }
}
var adminCrudRouter = router({
  schools: router({
    list: adminProcedure.query(() => withDatabaseError(() => listSchools())),
    create: adminProcedure.input(z2.object({ name: z2.string().min(2), code: z2.string().min(2).max(32) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createSchool(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "schools", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z2.string().min(2).optional(), code: z2.string().min(2).max(32).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateSchool(input.id, { name: input.name, code: input.code, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "schools", recordId: input.id });
      return { success: true };
    }))
  }),
  teachers: router({
    list: adminProcedure.query(() => withDatabaseError(() => listTeachers(void 0, true))),
    create: adminProcedure.input(z2.object({ name: z2.string().min(2), cpf: z2.string().min(11), email: z2.string().email().optional(), schoolId: z2.number().int().positive(), userId: z2.number().int().positive().optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createTeacher(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "teachers", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z2.string().min(2).optional(), cpf: z2.string().min(11).optional(), email: z2.string().email().optional(), schoolId: z2.number().int().positive().optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateTeacher(input.id, { name: input.name, cpf: input.cpf, email: input.email, schoolId: input.schoolId, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "teachers", recordId: input.id });
      return { success: true };
    }))
  }),
  classes: router({
    list: adminProcedure.query(() => withDatabaseError(() => listClasses(void 0, true))),
    create: adminProcedure.input(z2.object({ name: z2.string().min(1), grade: z2.string().min(1), schoolId: z2.number().int().positive(), teacherId: z2.number().int().positive(), year: z2.number().int().min(2020).max(2100) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createClass(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "classes", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z2.string().min(1).optional(), grade: z2.string().min(1).optional(), schoolId: z2.number().int().positive().optional(), teacherId: z2.number().int().positive().optional(), year: z2.number().int().min(2020).max(2100).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateClass(input.id, { name: input.name, grade: input.grade, schoolId: input.schoolId, teacherId: input.teacherId, year: input.year, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "classes", recordId: input.id });
      return { success: true };
    }))
  }),
  students: router({
    list: adminProcedure.input(z2.object({ classId: z2.number().int().positive().optional(), schoolId: z2.number().int().positive().optional(), search: z2.string().optional() }).optional()).query(({ input }) => withDatabaseError(() => listStudents({ ...input, isAdmin: true }))),
    create: adminProcedure.input(z2.object({ name: z2.string().min(2), cpf: z2.string().min(11), schoolId: z2.number().int().positive(), classId: z2.number().int().positive() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createStudent(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "students", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z2.string().min(2).optional(), cpf: z2.string().min(11).optional(), schoolId: z2.number().int().positive().optional(), classId: z2.number().int().positive().optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateStudent(input.id, { name: input.name, cpf: input.cpf, schoolId: input.schoolId, classId: input.classId, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "students", recordId: input.id });
      return { success: true };
    }))
  }),
  subjects: router({
    list: adminProcedure.query(() => withDatabaseError(() => listSubjects(true))),
    create: adminProcedure.input(z2.object({ name: z2.string().min(2), code: z2.string().min(2).max(32) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createSubject(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "subjects", recordId: Number(id) });
      return { id: Number(id) };
    })),
    update: adminProcedure.input(idInput.extend({ name: z2.string().min(2).optional(), code: z2.string().min(2).max(32).optional(), status: statusInput.optional() })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await updateSubject(input.id, { name: input.name, code: input.code, status: input.status });
      await addAuditLog({ userId: ctx.user.id, action: "update", tableName: "subjects", recordId: input.id });
      return { success: true };
    }))
  }),
  questions: router({
    list: adminProcedure.input(z2.object({ subjectId: z2.number().int().positive().optional(), search: z2.string().optional() }).optional()).query(({ input }) => withDatabaseError(() => listQuestions(input ?? {}))),
    get: adminProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getQuestionWithOptions(input.id))),
    create: adminProcedure.input(z2.object({
      subjectId: z2.number().int().positive(),
      statement: z2.string().min(5),
      questionType: z2.enum(["multiple_choice", "true_false", "short_answer"]),
      difficulty: z2.enum(["easy", "medium", "hard"]),
      unitTheme: z2.string().optional(),
      skill: z2.string().optional(),
      descriptor: z2.string().optional(),
      content: z2.string().optional(),
      imageUrl: z2.string().url().optional(),
      correctAnswer: z2.string().min(1),
      points: z2.number().int().min(1).max(100),
      options: z2.array(z2.object({ optionLabel: z2.enum(["A", "B", "C", "D", "E"]), optionText: z2.string().min(1), isCorrect: z2.boolean() })).max(5)
    })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createQuestion(input);
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "questions", recordId: Number(id) });
      return { id: Number(id) };
    }))
  }),
  assessments: router({
    list: adminProcedure.query(() => withDatabaseError(() => listAssessments())),
    get: adminProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getAssessmentWithQuestions(input.id))),
    create: adminProcedure.input(z2.object({ name: z2.string().min(2), description: z2.string().optional(), subjectId: z2.number().int().positive(), startDate: dateInput, endDate: dateInput, timeLimit: z2.number().int().min(1).max(240), maxScore: z2.number().min(1).max(100), allowSingleAttempt: z2.boolean(), shuffleQuestions: z2.boolean(), shuffleOptions: z2.boolean(), showResultImmediately: z2.boolean(), allowReview: z2.boolean(), questionIds: z2.array(z2.number().int().positive()).min(1) })).mutation(({ ctx, input }) => withDatabaseError(async () => {
      const id = await createAssessment({ ...input, createdBy: ctx.user.id });
      await addAuditLog({ userId: ctx.user.id, action: "create", tableName: "assessments", recordId: Number(id) });
      return { id: Number(id) };
    })),
    publish: adminProcedure.input(idInput).mutation(({ ctx, input }) => withDatabaseError(async () => {
      await publishAssessment(input.id);
      await addAuditLog({ userId: ctx.user.id, action: "publish", tableName: "assessments", recordId: input.id });
      return { success: true };
    }))
  })
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  public: router({
    catalog: publicProcedure.query(() => withDatabaseError(async () => {
      const [schoolRows, classRows, assessmentRows] = await Promise.all([listSchools(), listClasses(void 0, true), listAssessments()]);
      return { schools: schoolRows.filter((school) => school.status === "active"), classes: classRows.filter((classRow) => classRow.status === "active"), assessments: assessmentRows.filter((assessment) => assessment.status === "published") };
    })),
    startAttempt: publicProcedure.input(z2.object({ assessmentId: z2.number().int().positive(), schoolId: z2.number().int().positive(), classId: z2.number().int().positive(), cpf: z2.string().min(11) })).mutation(({ input }) => withDatabaseError(() => startAttempt(input))),
    getAttempt: publicProcedure.input(idInput).query(({ input }) => withDatabaseError(() => getAttempt(input.id))),
    saveAnswer: publicProcedure.input(z2.object({ attemptId: z2.number().int().positive(), questionId: z2.number().int().positive(), selectedAnswer: z2.string().optional().nullable() })).mutation(({ input }) => withDatabaseError(() => saveAnswer(input))),
    submitAttempt: publicProcedure.input(idInput.extend({ forceExpired: z2.boolean().optional() })).mutation(({ input }) => withDatabaseError(() => submitAttempt(input.id, input.forceExpired)))
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
    students: protectedProcedure.input(z2.object({ classId: z2.number().int().positive().optional(), search: z2.string().optional() }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
      const isAdmin = ctx.user.role === "admin";
      await ensureStaff(ctx.user);
      return listStudents({ ...input, userId: ctx.user.id, isAdmin });
    })),
    results: protectedProcedure.input(z2.object({ classId: z2.number().int().positive().optional(), subjectId: z2.number().int().positive().optional(), assessmentId: z2.number().int().positive().optional(), teacherId: z2.number().int().positive().optional(), skill: z2.string().optional(), search: z2.string().optional(), minPercentage: z2.number().min(0).max(100).optional(), maxPercentage: z2.number().min(0).max(100).optional(), from: dateInput, to: dateInput }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
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
    }))
  }),
  reports: protectedProcedure.input(z2.object({ reportType: z2.enum(["general", "class", "student"]).optional(), schoolId: z2.number().int().positive().optional(), classId: z2.number().int().positive().optional(), teacherId: z2.number().int().positive().optional(), subjectId: z2.number().int().positive().optional(), assessmentId: z2.number().int().positive().optional(), skill: z2.string().optional(), search: z2.string().optional(), minPercentage: z2.number().min(0).max(100).optional(), maxPercentage: z2.number().min(0).max(100).optional(), from: dateInput, to: dateInput }).optional()).query(({ ctx, input }) => withDatabaseError(async () => {
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
      avalia\u00E7\u00E3o: row.assessment?.name ?? "",
      disciplina: row.subject?.name ?? "",
      acertos: row.attempt.correctAnswers,
      erros: row.attempt.wrongAnswers,
      percentual: Number(row.attempt.percentage),
      nota: Number(row.attempt.score),
      data: row.attempt.finishedAt?.toISOString() ?? ""
    }));
  }))
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/app.ts
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "50mb" }));
  app2.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app2);
  registerOAuthRoutes(app2);
  app2.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  return app2;
}

// api/index.ts
var app = createApp();
var index_default = app;
export {
  index_default as default
};
