// Mission 3: Communication with Doctors, Families and Friends
// Real per-topic prompt copy for providing_updates_doctor, doctor_rounds,
// answering_family_questions, and discharging_patients.
export const mission3Prompts: Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}> = {
	providing_updates_doctor: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a pronunciation drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week:
{{weak_phonemes}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Pronunciation Selection

- Prioritize the student's weak phonemes ({{weak_phonemes}}).
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used when nurses provide updates to physicians.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic nursing vocabulary commonly spoken during nurse-to-doctor communication.

Examples include:

- physician
- recommendation
- assessment
- deteriorating
- respiratory
- oxygen saturation
- blood pressure
- intervention
- laboratory results
- electrocardiogram
- intravenous fluids
- hypotension
- sepsis
- allergy
- diagnosis
- chest pain
- medication
- observation
- escalation
- evaluate

3. Clinical Context

- Every sentence should sound like authentic nurse-to-doctor communication used in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect a nurse updating a physician.
- Include realistic patient information such as:
  - patient identification
  - diagnosis
  - symptoms
  - vital signs
  - medications
  - laboratory results
  - imaging findings
  - nursing assessment
  - physician recommendations
  - pending investigations
  - deterioration
  - escalation plans

Examples:

- "Dr. Patel, the patient's oxygen saturation has fallen to eighty-eight percent."
- "I'm calling because the patient's blood pressure continues to decrease."
- "Would you recommend repeating the laboratory tests?"
- "The patient became increasingly short of breath despite oxygen therapy."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- identify themselves, their unit and the patient
- state the reason for calling promptly
- provide concise and accurate clinical information
- report vital signs and assessment findings
- discuss medications and investigations
- request recommendations or physician orders
- clarify unclear instructions
- confirm the agreed management plan

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories, including:
  - patient assessment
  - medications
  - laboratory results
  - imaging
  - diagnoses
  - deterioration
  - physician communication
  - interventions
  - escalation
  - patient safety

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural nurse-to-doctor sentence}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a fill-in-the-blank vocabulary drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Clinical Context

- Every sentence should describe a realistic nurse-to-doctor conversation in a hospital in {{country}}.
- The sentence should sound like something a nurse would say while calling a physician or responding during the call.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough clinical information that only one answer is correct.
- Include realistic details such as:
  - patient identification
  - diagnosis
  - symptoms
  - vital signs
  - medications
  - allergies
  - assessment findings
  - laboratory results
  - imaging findings
  - physician orders
  - nursing interventions
  - pending investigations
  - deterioration in condition

3. Vocabulary Selection

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used when updating physicians.
- Use authentic clinical vocabulary rather than textbook terminology.

Examples include:

- deteriorating
- assessment
- recommendation
- intervention
- physician
- oxygen saturation
- blood pressure
- respiratory distress
- intravenous fluids
- chest pain
- electrocardiogram
- laboratory results
- allergy
- sepsis
- hypotension

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four clinically legitimate answer choices.
- Exactly one option must be correct.
- The remaining options should also be realistic medical vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use clinical reasoning.

The correct answer should reinforce one or more of the following competencies:

- Identifying the patient correctly
- Stating the reason for the call
- Reporting accurate assessment findings
- Reporting vital signs
- Reporting medications
- Reporting abnormal laboratory or imaging results
- Requesting recommendations or physician orders
- Confirming follow-up actions

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used while providing patient updates to physicians.

Every sentence should reinforce professional nurse-to-doctor communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should be realistic and sound like an actual conversation or documentation used in hospitals in {{country}}.
- Avoid dictionary definitions or generic examples.

8. Medical Terminology

- Use full clinical terminology rather than abbreviations whenever possible.

Example:

Correct:
"intravenous fluids"

Incorrect:
"IV fluids"

9. Difficulty

- Include a balanced mix of common and moderately difficult clinical vocabulary.
- Require understanding of the clinical context rather than simple word recognition.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a key phrases drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week:
{{missed_phrases}}

Generate 10–15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Doctor says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic nurse-to-doctor communication in hospitals in {{country}}.
- The learner always plays the bedside nurse.
- The AI plays a physician receiving a patient update or giving medical instructions.
- Every situation should involve a nurse providing a patient update, answering the physician's questions, requesting recommendations, clarifying orders, or confirming the management plan.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard between nurses and physicians.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following competencies:
  - identifying yourself, your unit, and the patient
  - stating the reason for the call immediately
  - providing accurate patient information
  - requesting recommendations or physician orders
  - clarifying unclear instructions
  - confirming physician orders before ending the call

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two or more responses that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, collaborative, and clinically appropriate response.

The correct response should demonstrate one or more of the following:

- identifies the patient clearly
- explains the reason for the call promptly
- reports relevant assessment findings
- reports abnormal vital signs
- reports medications or recent interventions
- requests recommendations appropriately
- asks relevant clarification questions
- accurately repeats physician orders
- confirms the agreed management plan

Incorrect responses should be plausible but less appropriate because they:

- provide incomplete information
- delay the reason for the call
- omit important assessment findings
- fail to clarify physician instructions
- fail to confirm orders
- communicate less effectively

5. Scenario Variety

Include a balanced mix of situations involving:

- deteriorating patients
- abnormal vital signs
- chest pain
- respiratory distress
- reduced oxygen saturation
- postoperative complications
- abnormal laboratory results
- abnormal CT or X-ray findings
- medication concerns
- allergic reactions
- uncontrolled pain
- altered mental status
- sepsis
- physician recommendations
- escalation of care

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication while providing patient updates to physicians.

Every option should sound like something a professional nurse could realistically say.

The correct answer must be unambiguously the best response for the specific clinical situation.

Return a JSON array:

[
  {
    "doctorName": "{{Doctor Name}}",
    "prompt": "{{What the doctor says}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week:
{{practiced_scenarios}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic nurse-to-doctor communication in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the bedside nurse calling a physician to provide a patient update.
- The AI should play one or more physicians receiving the call.
- The scenario should progress naturally from recognising a change in the patient's condition, contacting the physician, providing relevant information, receiving new orders, and confirming the plan before ending the call.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for physicians working in hospitals in {{country}}.

Examples:
- Dr. Michael Patel
- Dr. Sarah Johnson
- Dr. David Kim
- Dr. Emily Carter

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication and overly formal wording.
- Use authentic nurse-to-doctor communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Clearly identifies themselves, their unit and the patient at the beginning of the call.
- States the reason for calling immediately.
- Gives accurate and relevant patient information including diagnosis, vital signs, symptoms, assessment findings, medications, allergies and recent changes.
- Requests recommendations, new orders or medical review appropriately.
- Asks clarification questions whenever instructions are unclear.
- Confirms understanding by repeating important orders and summarising the agreed plan before ending the call.

5. Realism

Include realistic clinical situations such as:

- sudden deterioration
- abnormal vital signs
- chest pain
- worsening shortness of breath
- decreased oxygen saturation
- abnormal laboratory results
- abnormal CT or X-ray findings
- uncontrolled pain
- altered mental status
- medication concerns
- allergic reactions
- sepsis
- postoperative complications

Include realistic clinical information such as:

- diagnosis
- admission reason
- vital signs
- medications
- allergies
- laboratory results
- imaging findings
- oxygen therapy
- intravenous access
- recent nursing interventions
- pending investigations
- physician instructions

Some information should require the learner to ask clarification questions before carrying out the physician's orders.

6. Learning Objective

The learner should develop automatic, confident and professional communication when providing updates to physicians.

The learner should naturally practise:

- introducing themselves clearly
- identifying the patient
- stating the reason for the call promptly
- presenting concise and relevant patient information
- requesting recommendations or orders
- clarifying unclear instructions
- confirming and repeating back physician orders before ending the call

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Doctor Name}}"
  ],
  "context": "{{Brief description of the clinical situation}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON.
No markdown.
No explanation.

`,
	},
	doctor_rounds: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a pronunciation drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week:
{{weak_phonemes}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Pronunciation Selection

- Prioritize the student's weak phonemes ({{weak_phonemes}}).
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during doctors' ward rounds.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic nursing vocabulary commonly spoken while presenting patients during ward rounds.

Examples include:

- multidisciplinary
- rehabilitation
- mobility
- assessment
- diagnosis
- physician
- recommendation
- discharge planning
- skin integrity
- wound care
- oxygen saturation
- laboratory results
- intravenous fluids
- fall risk
- treatment plan
- intervention
- evaluation
- deterioration
- physiotherapy
- consultation

3. Clinical Context

- Every sentence should sound like authentic communication used during doctors' ward rounds in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect a bedside nurse participating in ward rounds.
- Include realistic patient information such as:
  - patient identification
  - diagnosis
  - overnight events
  - assessment findings
  - vital signs
  - medications
  - laboratory results
  - imaging findings
  - nursing priorities
  - patient concerns
  - family concerns
  - physician recommendations
  - rehabilitation goals
  - discharge planning
  - pending investigations

Examples:

- "Mr. Miller's mobility has improved since yesterday."
- "The patient's oxygen saturation remained stable overnight."
- "Our biggest nursing concern is her high fall risk."
- "The family would like an update on the discharge planning."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- identify themselves, their role, and the patient
- deliver a concise patient update
- communicate nursing priorities and patient concerns
- discuss safety risks
- report assessment findings
- contribute relevant clinical information
- participate in multidisciplinary care planning
- clarify physician recommendations
- confirm the agreed treatment plan and follow-up actions

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories, including:
  - diagnoses
  - nursing assessment
  - medications
  - laboratory results
  - imaging
  - patient safety
  - rehabilitation
  - discharge planning
  - multidisciplinary communication
  - physician recommendations

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural ward round sentence}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a fill-in-the-blank vocabulary drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Clinical Context

- Every sentence should describe a realistic conversation during doctors' ward rounds in a hospital in {{country}}.
- The sentence should sound like something a bedside nurse would say while presenting a patient or responding to a physician's question during rounds.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough clinical information that only one answer is correct.
- Include realistic details such as:
  - patient identification
  - diagnosis
  - current condition
  - overnight events
  - assessment findings
  - vital signs
  - medications
  - allergies
  - laboratory results
  - imaging findings
  - nursing priorities
  - patient or family concerns
  - physician recommendations
  - discharge planning
  - rehabilitation needs

3. Vocabulary Selection

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during doctors' rounds.
- Use authentic clinical vocabulary rather than textbook terminology.

Examples include:

- assessment
- diagnosis
- treatment plan
- discharge planning
- rehabilitation
- mobility
- fall risk
- wound care
- oxygen saturation
- laboratory results
- intravenous fluids
- skin integrity
- physician recommendation
- multidisciplinary
- pending investigation

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four clinically legitimate answer choices.
- Exactly one option must be correct.
- The remaining options should also be realistic medical vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use clinical reasoning.

The correct answer should reinforce one or more of the following competencies:

- identifying the patient correctly
- presenting a concise patient update
- communicating nursing priorities
- discussing patient or family concerns
- reporting assessment findings
- discussing discharge planning
- participating in care planning
- confirming physician recommendations

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used during doctors' ward rounds while improving professional communication.

Every sentence should reinforce participation in multidisciplinary discussions.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should sound like authentic communication used during ward rounds.
- Avoid dictionary definitions or generic examples.

8. Medical Terminology

- Use full clinical terminology rather than abbreviations whenever possible.

Example:

Correct:
"intravenous fluids"

Incorrect:
"IV fluids"

9. Difficulty

- Include a balanced mix of common and moderately difficult clinical vocabulary.
- Require understanding of the clinical context rather than simple word recognition.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a key phrases drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week:
{{missed_phrases}}

Generate 10–15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Doctor says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic multidisciplinary ward rounds in hospitals in {{country}}.
- The learner always plays the bedside nurse participating in the doctor's rounds.
- The AI plays one or more physicians leading the ward round.
- Every situation should involve discussing a patient, presenting an update, answering questions, raising nursing concerns, participating in care planning, or confirming the next steps.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during doctors' ward rounds.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following competencies:
  - identifying yourself, your role, and the patient
  - delivering a concise and accurate patient update
  - communicating nursing priorities and patient concerns
  - participating in care planning
  - seeking clarification when necessary
  - confirming the agreed treatment plan and follow-up actions

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two or more responses that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, collaborative, and clinically appropriate response.

The correct response should demonstrate one or more of the following:

- introduces the patient clearly
- summarises the patient's condition accurately
- reports relevant assessment findings
- communicates nursing priorities
- raises patient or family concerns
- contributes relevant clinical information
- requests clarification appropriately
- confirms physician recommendations
- summarises the agreed care plan

Incorrect responses should be plausible but less appropriate because they:

- omit important clinical information
- fail to prioritise key nursing concerns
- provide incomplete patient updates
- fail to clarify physician instructions
- overlook patient or family concerns
- communicate less effectively

5. Scenario Variety

Include a balanced mix of situations involving:

- postoperative recovery
- respiratory deterioration
- abnormal laboratory results
- abnormal imaging findings
- wound care
- skin integrity
- pain management
- mobility and rehabilitation
- fall risk
- discharge planning
- patient and family concerns
- multidisciplinary care
- pending investigations
- medication changes
- physician recommendations

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication while participating in doctors' ward rounds.

Every option should sound like something a professional nurse could realistically say.

The correct answer must be unambiguously the best response for the specific clinical situation.

Return a JSON array:

[
  {
    "doctorName": "{{Doctor Name}}",
    "prompt": "{{What the doctor says}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week:
{{practiced_scenarios}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic multidisciplinary ward rounds in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the bedside nurse participating in the doctor's rounds.
- The AI should play one or more physicians leading the ward rounds. Other healthcare professionals, such as pharmacists or physiotherapists, may occasionally contribute naturally to the discussion.
- The scenario should progress naturally from arriving at the patient's bedside, presenting the patient update, discussing concerns and care priorities, and confirming the management plan before moving to the next patient.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for healthcare professionals in hospitals in {{country}}.

Examples:
- Dr. Michael Patel
- Dr. Sarah Johnson
- Dr. Emily Carter
- Dr. David Kim
- Rachel Green (Physiotherapist)
- James Wilson (Pharmacist)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication and overly formal wording.
- Use authentic communication commonly heard during hospital ward rounds.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Clearly identifies themselves, their role, and the patient being discussed.
- Delivers a concise and accurate patient update, including diagnosis, current condition, assessment findings, vital signs, treatments, and significant changes.
- Communicates nursing priorities, safety concerns, patient or family concerns, barriers to care, and discharge considerations.
- Participates in care planning by contributing relevant information, asking clarification questions when needed, and confirming physician orders, follow-up actions, and the agreed plan of care.

5. Realism

Include realistic ward round discussions involving 2–4 patients.

Include realistic clinical information such as:

- diagnosis
- reason for admission
- current condition
- overnight events
- vital signs
- medications
- allergies
- intravenous access
- oxygen therapy
- wound care
- skin assessment
- mobility
- pain management
- laboratory results
- CT findings
- X-ray findings
- pending investigations
- nursing concerns
- patient concerns
- family concerns
- discharge planning
- rehabilitation needs
- physician recommendations

Some information should require the learner to clarify physician instructions or provide additional nursing observations.

6. Learning Objective

The learner should develop automatic, confident, and professional communication while participating in multidisciplinary ward rounds.

The learner should naturally practise:

- introducing themselves professionally
- identifying the patient correctly
- delivering concise patient summaries
- highlighting nursing priorities
- raising patient concerns
- contributing relevant clinical information
- asking clarification questions
- confirming the agreed management plan before moving to the next patient

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Doctor Name}}",
    "{{Healthcare Professional Name}}"
  ],
  "context": "{{Brief description of the ward round}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON.
No markdown.
No explanation.

`,
	},
	answering_family_questions: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a pronunciation drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week:
{{weak_phonemes}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Pronunciation Selection

- Prioritize the student's weak phonemes ({{weak_phonemes}}).
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used when communicating with patients' families and friends.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic nursing vocabulary commonly spoken during conversations with families and visitors.

Examples include:

- confidentiality
- authorised
- identification
- representative
- physician
- prognosis
- diagnosis
- rehabilitation
- discharge planning
- treatment plan
- laboratory results
- medical record
- consent
- privacy
- visitor
- family member
- condition
- medication
- recovery
- support

3. Clinical Context

- Every sentence should sound like authentic communication between a nurse and a patient's family member or friend in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect conversations about patient care while maintaining professional boundaries.
- Include realistic situations such as:
  - verifying identity
  - confirming authorisation
  - providing appropriate updates
  - explaining confidentiality
  - discussing nursing care
  - referring questions to the physician
  - discharge planning
  - emotional support
  - rehabilitation
  - pending laboratory or imaging results

Examples:

- "Before I discuss your mother's condition, could you confirm your relationship to her?"
- "I'm sorry you're worried, and I'll share the information I'm authorised to provide."
- "The physician will speak with you after reviewing the CT scan results."
- "For privacy reasons, I need to confirm that you're the authorised contact."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- verify identity and authorisation
- provide appropriate patient information
- communicate with empathy and professionalism
- protect patient confidentiality
- explain professional boundaries
- refer questions appropriately
- reassure family members while remaining within the nurse's scope of practice

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories, including:
  - patient privacy
  - confidentiality
  - communication
  - diagnosis
  - medications
  - investigations
  - rehabilitation
  - discharge planning
  - patient support
  - professional communication

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural nurse-to-family sentence}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a fill-in-the-blank vocabulary drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following words this week:
{{weak_words}}

Generate 10–15 vocabulary questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Clinical Context

- Every sentence should describe a realistic telephone conversation between healthcare colleagues in a hospital in {{country}}.
- The sentence should sound like something a nurse would naturally say while speaking with another nurse, charge nurse, physician, pharmacist, or other healthcare professional.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough clinical information that only one answer is correct.
- Include realistic details such as:
  - introducing yourself and your unit
  - identifying the patient
  - stating the purpose of the call
  - diagnosis
  - assessment findings
  - vital signs
  - medications
  - nursing interventions
  - laboratory results
  - imaging findings
  - pending investigations
  - consultations
  - patient transfer
  - escalation
  - follow-up actions

3. Vocabulary Selection

- Begin with the student's weak words ({{weak_words}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during telephone communication between healthcare professionals.
- Use authentic clinical vocabulary rather than textbook terminology.

Examples include:

- assessment
- recommendation
- clarification
- intervention
- consultation
- transfer
- deterioration
- observation
- physician
- charge nurse
- laboratory results
- oxygen saturation
- intravenous fluids
- medication order
- follow-up

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four clinically legitimate answer choices.
- Exactly one option must be correct.
- The remaining options should also be realistic medical vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use clinical reasoning.

The correct answer should reinforce one or more of the following competencies:

- identifying yourself and the patient
- stating the purpose of the call
- reporting assessment findings
- communicating changes in the patient's condition
- requesting recommendations
- confirming responsibilities
- clarifying instructions
- confirming follow-up actions

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used during professional telephone communication with healthcare colleagues.

Every sentence should reinforce clear, concise, and safe communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should sound like authentic communication used during hospital telephone conversations.
- Avoid dictionary definitions or generic examples.

8. Medical Terminology

- Use full clinical terminology rather than abbreviations whenever possible.

Example:

Correct:
"intravenous fluids"

Incorrect:
"IV fluids"

9. Difficulty

- Include a balanced mix of common and moderately difficult clinical vocabulary.
- Require understanding of the clinical context rather than simple word recognition.

Return a JSON array:

[
  {
    "vocabulary": "{{correct vocabulary}}",
    "sentence": "{{Sentence containing ______}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a key phrases drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week:
{{missed_phrases}}

Generate 10–15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Colleague says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic telephone communication between healthcare professionals in hospitals in {{country}}.
- The learner always plays the nurse making or receiving the phone call.
- The AI plays another healthcare professional, such as a staff nurse, charge nurse, physician, pharmacist, physiotherapist, respiratory therapist, or laboratory staff member.
- Every situation should involve introducing yourself, identifying the patient, explaining the purpose of the call, reporting clinical information, requesting assistance, clarifying information, or confirming next steps.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during professional telephone conversations in hospitals.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following competencies:
  - identifying yourself, your role, your unit, and the patient
  - stating the purpose of the call clearly
  - communicating relevant assessment findings and clinical information
  - requesting recommendations or assistance appropriately
  - seeking clarification when necessary
  - confirming responsibilities and follow-up actions before ending the call

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two or more responses that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, collaborative, and clinically appropriate response.

The correct response should demonstrate one or more of the following:

- introduces the nurse, unit, and patient clearly
- explains the reason for the call promptly
- reports relevant assessment findings
- communicates changes in the patient's condition accurately
- requests assistance or recommendations appropriately
- asks appropriate clarification questions
- confirms responsibilities
- repeats important instructions or follow-up actions before ending the call

Incorrect responses should be plausible but less appropriate because they:

- delay the purpose of the call
- omit important patient information
- provide incomplete assessment findings
- fail to clarify instructions
- fail to confirm responsibilities
- communicate less effectively

5. Scenario Variety

Include a balanced mix of situations involving:

- deteriorating patients
- medication clarification
- abnormal laboratory results
- abnormal imaging findings
- urgent consultations
- patient transfers
- oxygen therapy
- uncontrolled pain
- postoperative concerns
- equipment requests
- physician instructions
- discharge coordination
- documentation clarification
- escalation of care
- arranging follow-up

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication during telephone conversations with healthcare colleagues.

Every option should sound like something a healthcare professional could realistically say.

The correct answer must be unambiguously the best response for the specific clinical situation.

Return a JSON array:

[
  {
    "respondentName": "{{Healthcare Professional Name}}",
    "prompt": "{{What the colleague says}}",
    "options": [
      "{{option1}}",
      "{{option2}}",
      "{{option3}}",
      "{{option4}}"
    ],
    "correctOption": "{{A|B|C|D}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.

`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week:
{{practiced_scenarios}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic phone conversations between healthcare professionals in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the nurse making or receiving a work-related phone call.
- The AI should play one or more healthcare colleagues, such as another nurse, a charge nurse, a physician, a pharmacist, a physiotherapist, or another hospital staff member.
- The scenario should progress naturally from answering or placing the call, discussing the patient, exchanging relevant clinical information, agreeing on actions, and confirming the next steps before ending the call.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for healthcare professionals in hospitals in {{country}}.

Examples:
- Emily Rodriguez (Charge Nurse)
- James Wilson (Staff Nurse)
- Dr. Michael Patel
- Rachel Green (Physiotherapist)
- Olivia Brown (Pharmacist)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during professional phone calls in hospitals.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Clearly identifies themselves, their role or unit, and the patient at the beginning of the call.
- States the purpose of the call promptly and concisely.
- Provides relevant and accurate clinical information, including assessment findings, interventions, medications, vital signs, and significant changes in the patient's condition.
- Confirms recommendations, responsibilities, physician or colleague instructions, and follow-up actions by repeating or summarising important information before ending the call.

5. Realism

Include realistic phone conversations involving situations such as:

- requesting assistance
- reporting a deteriorating patient
- clarifying medication orders
- requesting patient transfer
- discussing laboratory or imaging results
- arranging consultations
- requesting equipment
- coordinating patient transport
- confirming physician instructions
- discussing discharge arrangements
- handing over urgent information
- resolving documentation questions

Include realistic clinical information such as:

- patient identification
- diagnosis
- reason for admission
- current condition
- vital signs
- medications
- allergies
- laboratory results
- imaging findings
- oxygen therapy
- intravenous access
- nursing interventions
- pending investigations
- physician recommendations
- escalation plans

Some information should require the learner to ask clarification questions or repeat instructions to confirm understanding.

6. Learning Objective

The learner should develop automatic, confident, and professional communication during telephone conversations with healthcare colleagues.

The learner should naturally practise:

- introducing themselves and identifying the patient
- stating the reason for the call clearly
- communicating concise and accurate clinical information
- requesting assistance or recommendations appropriately
- asking clarification questions when necessary
- confirming responsibilities and agreed follow-up actions before ending the call

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Healthcare Professional Name}}"
  ],
  "context": "{{Brief description of the phone communication scenario}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON.
No markdown.
No explanation.

`,
	},
	discharging_patients: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a pronunciation drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following phonemes this week: {{weak_phonemes}}

The student struggled with the following words this week: {{weak_words}}

Generate 10 - 15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Word:
{{word}}

Sentence:
{{example sentence}}

2. Important Requirements

- Prioritize the student's weak phonemes ({{weak_phonemes}}) first.
- Prioritize the student's weak words ({{weak_words}}) whenever they contain one of the target phonemes.
- If additional words are needed, supplement with vocabulary commonly used during patient discharges.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce while reviewing discharge instructions, medications, follow-up appointments, warning signs, home care, and answering patient questions.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples or dictionary definitions.
- Every sentence should naturally reflect patient discharge conversations.
- Use realistic patient names, medications, follow-up appointments, warning signs, home arrangements, mobility instructions, or hospital procedures where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:
- Introduces themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the discharge, what will happen during the process, and what the patient should expect at home.
- Confirms patient identity correctly using at least two identifiers (e.g., name and date of birth) before reviewing discharge instructions.
- Encourages the patient to ask questions about medications, follow-up care, warning signs, or home arrangements.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - medications
  - follow-up care
  - warning signs
  - home instructions
  - mobility and safety
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to patient discharges.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural clinical sentence}}"
  }
]

Return only valid JSON. No markdown. No explanation.


`,
		vocabulary: `You are a clinical English language coach for Korean nurses preparing to work in {{country}}.

Generate a fill-in-the-blank vocabulary drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}
- Competencies: {{competencies}}
- The student struggled with these words this week: {{weak_words}}

The goal is to strengthen the learner's clinical vocabulary while reinforcing the communication competencies required for this topic.

Generate 10-15 fill-in-the-blank questions according to the following rules.

1. Vocabulary Selection

- Use the student's weak words: {{weak_words}}.
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during patient discharges.
- Every vocabulary item must be directly relevant to the topic.
- Prioritize vocabulary that nurses actively use during discharge education, medication review, follow-up planning, safety instructions, and patient questions.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.

2. Competency Alignment

The vocabulary should naturally reinforce the following competencies:

{{competencies}}

Every question should require vocabulary that supports one or more of these competencies.

For example, vocabulary may relate to:

- discharge instructions
- medications and dosages
- follow-up appointments
- warning signs
- home care and safety
- mobility and activity restrictions
- wound care or equipment
- patient education
- professional clinical terminology

The competency should be demonstrated through the clinical situation rather than explicitly stated.

3. Sentence Design

- Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}.
- Replace only the target vocabulary with the blank.
- Every sentence must describe a realistic discharge situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - medications
  - follow-up appointments
  - warning signs
  - home arrangements
  - activity restrictions
  - patient questions
  - physician orders
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during discharge.

4. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but incorrect for the specific discharge situation because of:
  - incorrect medication instruction
  - incorrect follow-up advice
  - incorrect warning sign
  - incorrect safety guidance
  - incorrect clinical meaning
- Do not use nonsense words.
- Do not use synonyms of the correct answer.
- Do not use different grammatical forms of the correct answer.
- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Medical Terminology

- Do not use acronyms as the correct answer.
- Always use the full clinical term.

Example:

Correct:
"follow-up appointment"

Incorrect:
"F/U appointment"

- Use terminology commonly used by nurses in {{country}}.

6. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

7. Learning Objective

The learner's objective is to strengthen recognition and understanding of vocabulary commonly used during patient discharges while improving professional communication.

- Every option must be authentic medical vocabulary.
- The correct answer must be unambiguously correct for the specific discharge scenario.
- Incorrect answers should be plausible but incorrect because of incorrect patient identification, discharge instruction, medication advice, follow-up planning, or clinical meaning.
- Every sentence should reflect realistic patient discharge situations in hospitals.

8. Output Format

Return only valid JSON.

[
  {
    "vocabulary": "{{term}}",
    "sentence": "{{sentence with ______}}",
    "correctAnswer": "{{term}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON.

Do not include markdown.

Do not include explanations.

`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}

Generate a key phrases drill based on the following:
- Mission: {{mission}}
- Topic: {{topic}}

The student missed the following key phrases this week: {{missed_phrases}}

Generate 10 - 15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Important Requirements

- The conversation should reflect a realistic patient discharge situation in a hospital in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses, patients, family members, and physicians where appropriate.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that a competent nurse could realistically say.
- The learner must identify the MOST professional, concise, patient-centred, and appropriate response for the discharge situation.

- The correct answer should demonstrate one or more of the following competencies:

- Introduces themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the discharge, what will happen during the process, and what the patient should expect at home.
- Confirms patient identity correctly using at least two identifiers (e.g., name and date of birth) before reviewing discharge instructions.
- Encourages the patient to ask questions about medications, follow-up care, warning signs, or home arrangements.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication during patient discharges through repeated practice in realistic clinical scenarios.

- Every option should sound like something a professional nurse could realistically say.
- The correct answer must be unambiguously the best response for the specific discharge scenario.
- Incorrect answers should be plausible but incorrect because of incomplete patient identification, insufficient explanation, unclear medication or follow-up instructions, poor sequencing of the discharge process, or missed opportunities to encourage patient questions—not because they sound unprofessional.
- Every prompt must contain enough clinical detail that only one response is the best choice.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Patient, Family Member, Doctor, Incoming Nurse}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct nursing response}}",
    "options": [
      "{{correctAnswer}}",
      "{{wrong1}}",
      "{{wrong2}}",
      "{{wrong3}}"
    ]
  }
]

Return only valid JSON. No markdown. No explanation.


`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced these clinical scenarios this week: {{practiced_scenarios}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic patient discharge situations in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new discharge scenario.
- The student always plays the nurse.
- The scenario should progress naturally from greeting the patient to reviewing discharge instructions, answering questions, and confirming the patient is ready to leave safely.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Mr. David Thompson
  - Mrs. Linda Garcia
  - Dr. James Wilson
  - Emily Rodriguez
  - Sarah Chen
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete, natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during discharges in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Introduces themselves clearly by stating their name and role confidently and professionally.
- Explains the purpose of the discharge, what will happen during the process, and what the patient should expect at home.
- Confirms patient identity correctly using at least two identifiers (e.g., name and date of birth) before reviewing discharge instructions.
- Encourages the patient to ask questions about medications, follow-up care, warning signs, or home arrangements.

5. Realism

- Include realistic discharge activities such as verifying patient identity, reviewing medications and dosages, confirming follow-up appointments, explaining warning signs that require urgent care, discussing activity restrictions, confirming transportation or home support, and answering patient or family questions where appropriate.
- Patients should naturally ask questions about medications, when to return, what symptoms to watch for, wound care, diet, mobility, or what will happen next.
- Include natural interruptions and clarifying questions that reflect real discharge conversations.

6. Learning Objective

The learner's objective is to develop automatic, confident, and natural communication during patient discharges.

The roleplay should encourage the learner to:

- introduce themselves clearly
- explain the discharge process clearly
- confirm patient identity safely
- give clear medication and follow-up instructions
- invite and answer patient questions
- maintain patient safety and professionalism throughout the discharge process

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character 1}}",
    "{{AI Character 2}}"
  ],
  "context": "{{Brief scenario description}}",
  "roleplay_scenes": [
    {
      "scene_title": "{{Scene Title}}",
      "dialogue": [
        {
          "speaker": "student",
          "text": "{{dialogue}}"
        },
        {
          "speaker": "ai_0",
          "text": "{{dialogue}}"
        }
      ]
    }
  ]
}

Return only valid JSON. No markdown. No explanation.
`,
	},
};
