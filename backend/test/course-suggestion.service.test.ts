import assert from "node:assert/strict";
import test from "node:test";
import { suggestCoursesFromText } from "../src/modules/courses/course-suggestion.service.js";

const availableCourses = [
  "Biomedicina",
  "Enfermagem",
  "Engenharia Civil",
  "Engenharia da Computação",
  "Engenharia Mecânica",
  "Medicina Veterinária",
  "Nutrição",
  "Pedagogia",
  "Psicologia",
];

test("preenche somente o curso declarado explicitamente no PDF", () => {
  const result = suggestCoursesFromText({
    availableCourses,
    abstract:
      "A leucemia infantil exige cuidado interdisciplinar com apoio de nutricao, psicologia e fisioterapia.",
    extractedText:
      "Graduanda em Biomedicina, UNA-Pouso Alegre. A leucemia infantil exige cuidado interdisciplinar.",
  });

  assert.deepEqual(result.suggestedCourses, ["Biomedicina"]);
  assert.equal(result.courseSuggestions[0]?.name, "Biomedicina");
  assert.equal(result.courseSuggestions[0]?.source, "explicit-text");
  assert.equal(result.courseSuggestionConfidence, "high");
});

test("reconhece a declaracao de curso em trabalhos de medicina veterinaria", () => {
  const result = suggestCoursesFromText({
    availableCourses,
    title: "Importancia ecologica e aspectos biologicos do cateto",
    abstract: "A fauna silvestre possui relevancia para o equilibrio dos ecossistemas.",
    extractedText:
      "Academicos do curso de Medicina Veterinaria, Centro Universitario UNA. A fauna silvestre possui relevancia.",
  });

  assert.deepEqual(result.suggestedCourses, ["Medicina Veterinária"]);
  assert.equal(result.courseSuggestions[0]?.source, "explicit-text");
});

test("mantem sugestoes tematicas para revisao sem preencher silenciosamente", () => {
  const result = suggestCoursesFromText({
    availableCourses,
    title: "Tecnologia e inovacao no ensino contemporaneo",
    abstract: "A formacao docente e o processo de ensino aprendizagem foram analisados.",
  });

  assert.deepEqual(result.suggestedCourses, []);
  assert.equal(result.courseSuggestions[0]?.name, "Pedagogia");
  assert.equal(result.courseSuggestions[0]?.source, "content-keyword");
  assert.match(result.warnings[0] ?? "", /sugestoes tematicas/i);
});

test("nao aproxima engenharia eletrica de outro curso de engenharia", () => {
  const result = suggestCoursesFromText({
    availableCourses,
    title: "Reles de protecao: evolucao tecnologica e desempenho",
    abstract: "Analise de sistemas eletricos, corrente e tensao em redes de distribuicao.",
  });

  assert.deepEqual(result.suggestedCourses, []);
  assert.deepEqual(result.courseSuggestions, []);
});

test("nao confunde administracao de substancia com o curso de administracao", () => {
  const result = suggestCoursesFromText({
    availableCourses: [...availableCourses, "Administração", "Estética"],
    title: "Botulismo iatrogenico associado a procedimentos esteticos",
    abstract: "A administracao de toxina botulinica em procedimentos esteticos exige cuidado.",
  });

  assert.deepEqual(result.suggestedCourses, []);
  assert.equal(result.courseSuggestions.some((suggestion) => suggestion.name === "Administração"), false);
  assert.equal(result.courseSuggestions.some((suggestion) => suggestion.name === "Estética"), true);
});
