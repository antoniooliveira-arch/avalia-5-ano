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
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin", "teacher"]);
export const userStatusEnum = pgEnum("user_status", ["active", "blocked"]);
export const activeStatusEnum = pgEnum("active_status", ["active", "inactive"]);
export const questionTypeEnum = pgEnum("question_type", ["multiple_choice", "true_false", "short_answer"]);
export const difficultyEnum = pgEnum("difficulty", ["easy", "medium", "hard"]);
export const optionLabelEnum = pgEnum("option_label", ["A", "B", "C", "D", "E"]);
export const assessmentStatusEnum = pgEnum("assessment_status", ["draft", "published", "closed"]);
export const attemptStatusEnum = pgEnum("attempt_status", ["in_progress", "submitted", "expired"]);

export const users = pgTable(
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
    updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const schools = pgTable(
  "schools",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("schools_code_unique").on(table.code),
    nameIdx: index("schools_name_idx").on(table.name),
  }),
);

export const teachers = pgTable(
  "teachers",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    schoolId: integer("schoolId").notNull(),
    name: varchar("name", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    email: varchar("email", { length: 320 }),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: uniqueIndex("teachers_user_unique").on(table.userId),
    schoolIdx: index("teachers_school_idx").on(table.schoolId),
    cpfIdx: index("teachers_cpf_idx").on(table.cpf),
  }),
);

export const classes = pgTable(
  "classes",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 80 }).notNull(),
    grade: varchar("grade", { length: 32 }).default("5º Ano").notNull(),
    schoolId: integer("schoolId").notNull(),
    teacherId: integer("teacherId").notNull(),
    year: integer("year").notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    schoolIdx: index("classes_school_idx").on(table.schoolId),
    teacherIdx: index("classes_teacher_idx").on(table.teacherId),
    yearIdx: index("classes_year_idx").on(table.year),
  }),
);

export const students = pgTable(
  "students",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    cpf: varchar("cpf", { length: 14 }).notNull(),
    schoolId: integer("schoolId").notNull(),
    classId: integer("classId").notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    schoolIdx: index("students_school_idx").on(table.schoolId),
    classIdx: index("students_class_idx").on(table.classId),
    cpfIdx: index("students_cpf_idx").on(table.cpf),
  }),
);

export const subjects = pgTable(
  "subjects",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    code: varchar("code", { length: 32 }).notNull(),
    status: activeStatusEnum("status").default("active").notNull(),
  },
  (table) => ({
    codeUnique: uniqueIndex("subjects_code_unique").on(table.code),
  }),
);

export const questions = pgTable(
  "questions",
  {
    id: serial("id").primaryKey(),
    subjectId: integer("subjectId").notNull(),
    grade: varchar("grade", { length: 32 }).default("5º Ano").notNull(),
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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    subjectIdx: index("questions_subject_idx").on(table.subjectId),
    difficultyIdx: index("questions_difficulty_idx").on(table.difficulty),
    skillIdx: index("questions_skill_idx").on(table.skill),
  }),
);

export const questionOptions = pgTable(
  "question_options",
  {
    id: serial("id").primaryKey(),
    questionId: integer("questionId").notNull(),
    optionLabel: optionLabelEnum("optionLabel").notNull(),
    optionText: text("optionText").notNull(),
    isCorrect: boolean("isCorrect").default(false).notNull(),
  },
  (table) => ({
    questionIdx: index("question_options_question_idx").on(table.questionId),
  }),
);

export const assessments = pgTable(
  "assessments",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    description: text("description"),
    subjectId: integer("subjectId").notNull(),
    grade: varchar("grade", { length: 32 }).default("5º Ano").notNull(),
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
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    subjectIdx: index("assessments_subject_idx").on(table.subjectId),
    statusIdx: index("assessments_status_idx").on(table.status),
    dateIdx: index("assessments_start_date_idx").on(table.startDate),
  }),
);

export const assessmentQuestions = pgTable(
  "assessment_questions",
  {
    id: serial("id").primaryKey(),
    assessmentId: integer("assessmentId").notNull(),
    questionId: integer("questionId").notNull(),
    questionOrder: integer("questionOrder").notNull(),
    points: integer("points").default(1).notNull(),
  },
  (table) => ({
    assessmentIdx: index("assessment_questions_assessment_idx").on(table.assessmentId),
    questionIdx: index("assessment_questions_question_idx").on(table.questionId),
    uniqueQuestion: uniqueIndex("assessment_questions_unique").on(table.assessmentId, table.questionId),
  }),
);

export const attempts = pgTable(
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
    status: attemptStatusEnum("status").default("in_progress").notNull(),
  },
  (table) => ({
    assessmentIdx: index("attempts_assessment_idx").on(table.assessmentId),
    studentIdx: index("attempts_student_idx").on(table.studentId),
    statusIdx: index("attempts_status_idx").on(table.status),
    uniqueAttempt: uniqueIndex("attempts_single_unique").on(table.assessmentId, table.studentId),
  }),
);

export const answers = pgTable(
  "answers",
  {
    id: serial("id").primaryKey(),
    attemptId: integer("attemptId").notNull(),
    questionId: integer("questionId").notNull(),
    selectedAnswer: text("selectedAnswer"),
    correctAnswer: text("correctAnswer").notNull(),
    isCorrect: boolean("isCorrect").default(false).notNull(),
    points: integer("points").default(0).notNull(),
    answeredAt: timestamp("answeredAt").defaultNow().notNull(),
  },
  (table) => ({
    attemptIdx: index("answers_attempt_idx").on(table.attemptId),
    questionIdx: index("answers_question_idx").on(table.questionId),
    uniqueAnswer: uniqueIndex("answers_attempt_question_unique").on(table.attemptId, table.questionId),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId"),
    action: varchar("action", { length: 80 }).notNull(),
    tableName: varchar("tableName", { length: 80 }).notNull(),
    recordId: integer("recordId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index("audit_logs_user_idx").on(table.userId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type School = typeof schools.$inferSelect;
export type Teacher = typeof teachers.$inferSelect;
export type Class = typeof classes.$inferSelect;
export type Student = typeof students.$inferSelect;
export type Subject = typeof subjects.$inferSelect;
export type Question = typeof questions.$inferSelect;
export type QuestionOption = typeof questionOptions.$inferSelect;
export type Assessment = typeof assessments.$inferSelect;
export type AssessmentQuestion = typeof assessmentQuestions.$inferSelect;
export type Attempt = typeof attempts.$inferSelect;
export type Answer = typeof answers.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;