import { describe, expect, it } from "vitest";
import { calculateObjectiveResult, isValidCpf } from "./assessment-utils";
import { maskCpf, normalizeCpf } from "./db";

describe("assessment domain rules", () => {
  it("validates Brazilian CPF input without exposing it", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(maskCpf("52998224725")).toBe("529.•••.•••-25");
  });

  it("calculates weighted objective performance", () => {
    const result = calculateObjectiveResult([
      { expected: "A", selected: "a", points: 2 },
      { expected: "B", selected: "C", points: 1 },
      { expected: "C", selected: null, points: 1 },
      { expected: "D", selected: "D", points: 1 },
    ]);
    expect(result.totalQuestions).toBe(4);
    expect(result.totalPoints).toBe(5);
    expect(result.earnedPoints).toBe(3);
    expect(result.correctAnswers).toBe(2);
    expect(result.wrongAnswers).toBe(2);
    expect(result.percentage).toBe(60);
  });

  it("does not divide by zero for an empty assessment", () => {
    expect(calculateObjectiveResult([])).toMatchObject({ totalQuestions: 0, percentage: 0, correctAnswers: 0, wrongAnswers: 0 });
  });
});
