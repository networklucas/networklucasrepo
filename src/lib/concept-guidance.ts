import type {Concept} from './types';
export function conceptGuidance(c:Concept){
 if(/prioritization|strategic-build/.test(c.reference))return {inputs:'Objetivo, opções, capacidade, restrições e evidências de impacto e esforço.',mistake:'Dar notas sem dados ou misturar compromissos obrigatórios com escolhas.',output:'Comparação das opções, lacunas e próximo passo verificável.',example:'Aplicação ilustrativa: se o esforço de uma opção é desconhecido, registre a lacuna antes de classificá-la.'};
 if(/discovery|jtbd/.test(c.reference))return {inputs:'Público, situação, comportamento observado, evidências e hipótese principal.',mistake:'Tratar uma opinião ou uma persona simulada como evidência de demanda.',output:'Plano de investigação ligado a uma incerteza e uma decisão.',example:'Aplicação ilustrativa: reconstitua uma situação real de abandono antes de assumir qual mudança de interface resolveria o problema.'};
 if(/strategy|positioning|strategic-pm/.test(c.reference))return {inputs:'Público, problema, alternativas atuais, valor, restrições e resultado esperado.',mistake:'Usar uma meta numérica como substituto de escolhas estratégicas.',output:'Síntese de direção com foco, renúncias e sinais de progresso.',example:'Aplicação ilustrativa: explicite a alternativa manual usada pelo cliente antes de definir o diferencial do produto.'};
 return null;
}
