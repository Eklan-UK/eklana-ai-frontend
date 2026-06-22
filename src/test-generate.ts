import { generateDrill } from './domain/drills/ai-drill-generator.service';

generateDrill({
  drillType: 'pronunciation',
  difficulty: 'intermediate',
  context: 'ICU nurse at Mount Sinai giving handover',
  prompt: 'Generate pronunciation practice for an ICU nurse giving handover. Focus on medical terms like hypoxemia, dysarthria, CPAP, Vancomycin.',
  part: 'Part 1: Communication with Patients',
  topic: 'Handling Emergency/Critical Situation',
}).then(result => {
  console.log(JSON.stringify(result, null, 2));
}).catch(console.error);
