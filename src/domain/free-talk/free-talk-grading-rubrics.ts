import type { FreeTalkScenarioType } from '@/models/free-talk-scenario.shared';

export interface GradingBehaviour {
	id: number;
	name: string;
	description: string;
}

export const GRADING_RUBRICS: Record<FreeTalkScenarioType, GradingBehaviour[]> = {
	icu_emergency: [
		{ id: 1, name: 'Recognizes patient deterioration quickly', description: 'Identifies emergency signs such as low oxygen saturation, chest pain, respiratory distress, hypotension, or confusion without delay' },
		{ id: 2, name: 'Provides immediate appropriate intervention', description: 'Initiates correct first actions such as increasing oxygen, monitoring vital signs, positioning patient safely, or assessing symptoms' },
		{ id: 3, name: 'Gives clear patient instructions', description: 'Uses short, direct instructions such as "Take slow deep breaths" or "Please stay still"' },
		{ id: 4, name: 'Uses professional ICU terminology', description: 'Correctly uses terms like oxygen saturation, blood pressure, respiratory distress, chest tightness, or heart rhythm' },
	],
	cpr: [
		{ id: 1, name: 'Recognizes cardiac arrest and patient deterioration immediately', description: 'Identifies critical emergency signs such as unresponsiveness, absence of pulse, abnormal heart rhythm, respiratory failure, oxygen desaturation, or sudden collapse without delay' },
		{ id: 2, name: 'Initiates immediate high-quality CPR and emergency response appropriately', description: 'Begins correct emergency interventions promptly, including activating Code Blue, initiating chest compressions, applying oxygen support, requesting the defibrillator, and coordinating Rapid Response Unit procedures effectively' },
		{ id: 3, name: 'Gives clear, calm, and direct CPR instructions', description: 'Uses concise and professional emergency communication such as "Start compressions," "Call Code Blue," "Everybody clear," "Resume CPR," or "Take slow deep breaths" while maintaining calm leadership during critical situations' },
		{ id: 4, name: 'Uses professional ICU and CPR terminology accurately', description: 'Correctly uses clinical terminology such as cardiac arrest, chest compressions, ventricular fibrillation, oxygen saturation, pulse check, airway management, defibrillation, epinephrine, return of spontaneous circulation (ROSC), and heart rhythm during emergency communication' },
	],
	patient_follow_up: [
		{ id: 1, name: 'Recognizes patient concerns, symptoms, and recovery needs appropriately', description: 'Identifies and responds appropriately to patient concerns, symptoms, emotional distress, recovery progress, discharge questions, medication concerns, or changes in condition during follow-up conversations' },
		{ id: 2, name: 'Provides appropriate follow-up care information and patient guidance', description: 'Explains medications, monitoring, discharge planning, recovery expectations, safety precautions, and next steps clearly and professionally while supporting patient understanding and comfort' },
		{ id: 3, name: 'Gives clear, calm, and professional patient communication', description: 'Uses natural, reassuring, and easy-to-understand language when answering patient questions, providing education, giving instructions, or addressing concerns while maintaining smooth conversational flow and professional bedside manner' },
		{ id: 4, name: 'Uses professional, medication, and patient-care terminology appropriately', description: 'Correctly and naturally uses relevant clinical terminology related to medications, monitoring, recovery, discharge planning, vital signs, cardiac care, oxygen therapy, fall prevention, and patient assessment during follow-up conversations' },
	],
	admission: [
		{ id: 1, name: 'Introduces self clearly', description: 'States name and role confidently and professionally' },
		{ id: 2, name: 'Explains role and purpose of interaction', description: 'Clearly explains why they are there and what will happen during admission' },
		{ id: 3, name: 'Confirms patient identity correctly', description: 'Uses at least two identifiers appropriately (e.g., name and date of birth) to support patient safety' },
		{ id: 4, name: 'Encourages patient questions or concerns', description: 'Invites the patient to ask questions and demonstrates openness to communication' },
	],
	small_talk_patient: [
		{ id: 1, name: 'Uses appropriate social language', description: 'Uses natural conversational phrases suitable for healthcare settings without sounding overly formal or robotic' },
		{ id: 2, name: 'Responds naturally in conversation', description: 'Avoids scripted or awkward responses and maintains smooth conversational flow' },
		{ id: 3, name: 'Maintains professionalism throughout interaction', description: 'Keeps appropriate boundaries, respectful tone, and professional bedside behavior' },
		{ id: 4, name: 'Encourages patient comfort and engagement', description: 'Helps the patient feel relaxed, included, and willing to continue communication' },
	],
	handover_receive: [
		{ id: 1, name: 'Demonstrates active listening', description: 'Pays attention throughout the handover without distractions and focuses on understanding key information' },
		{ id: 2, name: 'Identifies critical information', description: 'Accurately recognizes and retains essential details such as diagnosis, current status, risks, medications, pending tasks, and safety concerns' },
		{ id: 3, name: 'Seeks clarification when needed', description: 'Asks relevant questions to clarify unclear, incomplete, or ambiguous information and ensure accurate understanding' },
		{ id: 4, name: 'Confirms understanding of the handover and next steps', description: 'Summarizes or repeats back key information, priorities, and required actions to verify mutual understanding, follow-up actions, and escalation requirements' },
	],
	handover: [
		{ id: 1, name: 'Gives concise and focused report', description: 'Communicates important information clearly without unnecessary details or excessive rambling' },
		{ id: 2, name: 'Organizes information logically', description: 'Presents information in clear sequence (e.g., diagnosis → events → treatment → monitoring needs)' },
		{ id: 3, name: 'Includes critical patient details', description: 'Mentions important clinical information such as diagnosis, vital changes, medications, procedures, safety concerns, or pending tasks' },
		{ id: 4, name: 'Uses SBAR/ISBAR communication structure appropriately', description: 'Demonstrates structured handoff communication with clear situation, background, assessment, and recommendations' },
	],
	decline_request: [
		{ id: 1, name: 'Maintains respectful and calm tone', description: 'Speaks politely and professionally without sounding rude, dismissive, or irritated' },
		{ id: 2, name: 'States limitation or refusal clearly', description: 'Clearly explains why the request cannot be fulfilled without being vague or overly apologetic' },
		{ id: 3, name: 'Avoids confrontation or defensive language', description: 'Maintains composure and avoids arguing, blaming, or escalating tension' },
		{ id: 4, name: 'Provides alternative solution or assistance', description: 'Offers another option, compromise, or next step when appropriate' },
	],
	small_talk_colleague: [
		{ id: 1, name: 'Uses appropriate workplace social language', description: 'Uses natural, friendly, and context-appropriate conversational language suitable for interactions with colleagues' },
		{ id: 2, name: 'Maintains conversational flow', description: 'Responds naturally to comments and questions, contributes relevant information, and keeps the conversation engaging without sounding scripted' },
		{ id: 3, name: 'Demonstrates professionalism and respect', description: "Maintains a respectful tone, appropriate workplace boundaries, and consideration for colleagues' perspectives and backgrounds" },
		{ id: 4, name: 'Builds rapport and positive relationships', description: 'Creates a friendly and inclusive atmosphere through active listening, showing interest, and encouraging collegial interaction' },
	],
	phone_doctor: [
		{ id: 1, name: 'Identifies self, unit, and patient appropriately', description: 'Clearly introduces themselves, unit/department, and patient information at the start of the call' },
		{ id: 2, name: 'States reason for call immediately', description: 'Quickly explains why they are calling without unnecessary delays or excessive background information' },
		{ id: 3, name: 'Gives accurate and relevant patient data', description: 'Provides correct vital signs, symptoms, assessment findings, medications, or changes in condition' },
		{ id: 4, name: 'Requests recommendation, orders, or action appropriately', description: 'Clearly states what is needed from the physician (evaluation, medication order, intervention, etc.)' },
	],
	doctor_rounds: [
		{ id: 1, name: 'Identifies self, role, and patient correctly', description: 'Clearly introduces themselves and their role and accurately identifies the patient being discussed during rounds' },
		{ id: 2, name: 'Delivers a concise and accurate patient update', description: "Provides an organized summary of the patient's diagnosis, current condition, relevant assessment findings, vital signs, treatments, and significant changes in status" },
		{ id: 3, name: 'Communicates nursing priorities and patient concerns', description: 'Identifies safety risks, nursing concerns, barriers to care, and relevant patient or family concerns that may affect treatment or discharge planning' },
		{ id: 4, name: 'Participates in care planning and clarifies next steps', description: 'Contributes relevant information to the discussion, seeks clarification when needed, and accurately confirms the plan of care, orders, and follow-up actions' },
	],
	phone_colleague: [
		{ id: 1, name: 'Identifies self, role, and patient correctly', description: 'Clearly introduces themselves, their role/unit, and accurately identifies the patient at the start of the call' },
		{ id: 2, name: 'States the purpose of the call clearly', description: 'Communicates the reason for the call promptly and concisely, ensuring the colleague understands the issue or request' },
		{ id: 3, name: 'Provides relevant and accurate clinical information', description: 'Shares pertinent information, assessment findings, interventions, and changes in condition in a clear and organized manner' },
		{ id: 4, name: 'Confirms recommendations and next steps', description: 'Clarifies recommendations, responsibilities, and follow-up actions, using read-back or confirmation when appropriate to ensure mutual understanding' },
	],
	phone_department: [
		{ id: 1, name: 'Identifies self, department, and patient correctly', description: 'Clearly introduces themselves, their unit/department, and accurately identifies the patient or service request' },
		{ id: 2, name: 'States the purpose of the call clearly', description: 'Communicates the reason for the call promptly and concisely, including the specific request, issue, or information needed' },
		{ id: 3, name: 'Provides relevant and accurate information', description: 'Shares all necessary details required to process the request, including patient information, timing, urgency, and any pertinent clinical or operational considerations' },
		{ id: 4, name: 'Confirms actions and follow-up requirements', description: 'Verifies that the request has been understood, clarifies expected actions or timelines, and confirms any required follow-up' },
	],
	family_questions: [
		{ id: 1, name: 'Verifies identity and authorization', description: 'Appropriately identifies the individual asking questions and determines whether they are authorized to receive patient information in accordance with privacy and confidentiality requirements' },
		{ id: 2, name: 'Provides accurate and appropriate information', description: 'Gives clear, accurate, and relevant information that is within their scope and permitted to be shared, avoiding speculation or misinformation' },
		{ id: 3, name: 'Demonstrates empathy and professional communication', description: 'Responds respectfully, listens actively, acknowledges concerns, and communicates in a calm, compassionate, and professional manner' },
		{ id: 4, name: 'Maintains confidentiality and escalates appropriately', description: 'Protects patient privacy, sets appropriate boundaries when information cannot be disclosed, and refers questions to the appropriate healthcare provider when necessary' },
	],
	phone_family: [
		{ id: 1, name: 'Verifies identity and authorization', description: "Confirms the identity of the caller and determines whether they are authorized to receive patient information before discussing any details about the patient's care" },
		{ id: 2, name: 'Communicates information clearly and accurately', description: 'Provides accurate, understandable, and appropriate information within their scope of practice, avoiding jargon and speculation' },
		{ id: 3, name: 'Demonstrates empathy and professionalism', description: 'Listens actively, acknowledges concerns, responds respectfully, and communicates with compassion and professionalism throughout the conversation' },
		{ id: 4, name: 'Maintains confidentiality and clarifies next steps', description: 'Protects patient privacy, appropriately limits information sharing when required, and clearly explains follow-up actions, referrals, or whom the caller should contact for additional information' },
	],
};
