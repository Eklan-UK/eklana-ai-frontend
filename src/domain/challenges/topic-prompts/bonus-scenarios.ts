// Mission 5: Bonus Scenarios
// Real per-topic prompt copy for phone_colleagues, phone_other_departments,
// phone_patient_families, conducting_cpr, discharging_patients, and grammar.
export const bonusScenarioPrompts: Record<string, {
	pronunciation: string;
	vocabulary: string;
	key_phrases: string;
	roleplay: string;
}> = {
	phone_colleagues: {
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
- If additional words are needed, supplement with vocabulary commonly used during telephone communication between healthcare professionals.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic nursing vocabulary commonly spoken during professional phone conversations.

Examples include:

- assessment
- recommendation
- clarification
- consultation
- intervention
- deterioration
- physician
- transfer
- responsibility
- follow-up
- oxygen saturation
- laboratory results
- intravenous fluids
- medication order
- escalation
- observation
- documentation
- confirmation
- communication
- discharge planning

3. Clinical Context

- Every sentence should sound like authentic telephone communication between healthcare professionals in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect a nurse communicating with another healthcare professional by phone.
- Include realistic situations such as:
  - introducing yourself and your unit
  - identifying the patient
  - explaining the purpose of the call
  - reporting assessment findings
  - discussing medications
  - reporting abnormal laboratory or imaging results
  - requesting recommendations
  - arranging consultations
  - coordinating patient transfers
  - confirming physician instructions
  - discussing escalation plans
  - confirming follow-up actions

Examples:

- "Hello, this is Amanda from the Intensive Care Unit calling about John Miller."
- "The patient's oxygen saturation has fallen despite oxygen therapy."
- "Could you clarify whether you want the medication given immediately?"
- "I'll repeat the order to make sure I've understood it correctly."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- identify themselves, their role, and the patient
- state the purpose of the phone call clearly
- communicate relevant clinical information accurately
- report assessment findings and nursing interventions
- request clarification when needed
- confirm recommendations and responsibilities
- repeat important instructions before ending the call

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories, including:
  - patient assessment
  - medications
  - laboratory results
  - imaging
  - communication
  - patient transfer
  - escalation
  - consultations
  - documentation
  - follow-up actions

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural telephone communication sentence}}"
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
{{fill_blank_evidence}}

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

- Begin with the student's weak words ({{fill_blank_evidence}}).
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

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
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
	phone_other_departments: {
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
- If additional words are needed, supplement with vocabulary commonly used during telephone communication with other hospital departments.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic clinical and operational vocabulary commonly spoken during interdepartmental telephone communication.

Examples include:

- radiology
- laboratory
- specimen
- pharmacist
- consultation
- transport
- scheduling
- availability
- confirmation
- physician order
- blood bank
- oxygen therapy
- isolation precautions
- intravenous fluids
- respiratory therapy
- diagnostic imaging
- patient transfer
- laboratory results
- interpreter
- discharge planning

3. Clinical Context

- Every sentence should sound like authentic telephone communication between a nurse and another hospital department in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect operational communication required to coordinate patient care.
- Include realistic situations such as:
  - introducing yourself and your unit
  - identifying the patient
  - requesting a service
  - scheduling diagnostic tests
  - requesting medications or blood products
  - arranging patient transport
  - discussing specimen collection
  - clarifying physician orders
  - communicating urgency
  - confirming appointment times
  - verifying departmental procedures
  - confirming follow-up actions

Examples:

- "I'm calling from the Intensive Care Unit to schedule a CT scan for Mr. Miller."
- "Has the laboratory received the blood specimen yet?"
- "Could you confirm the transport time for the patient?"
- "The physician has requested an urgent radiology consultation this afternoon."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- identify themselves, their unit, and the patient
- state the purpose of the call clearly
- provide complete clinical and operational information
- communicate urgency appropriately
- request hospital services professionally
- clarify departmental procedures
- confirm timelines and responsibilities
- repeat important follow-up actions before ending the call

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult clinical and operational terminology.
- Include words from different categories, including:
  - hospital departments
  - diagnostic services
  - laboratory services
  - pharmacy
  - patient transport
  - scheduling
  - physician orders
  - communication
  - follow-up actions
  - patient care coordination

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural interdepartmental telephone sentence}}"
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
{{fill_blank_evidence}}

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

- Every sentence should describe a realistic telephone conversation between a nurse and another hospital department in {{country}}.
- The sentence should sound like something a nurse would naturally say while speaking with Radiology, Laboratory, Pharmacy, Blood Bank, Respiratory Therapy, Patient Transport, Central Supply, Nutrition Services, Medical Records, or another hospital department.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough clinical and operational context that only one answer is correct.
- Include realistic details such as:
  - introducing yourself and your unit
  - identifying the patient
  - requesting a service
  - scheduling investigations
  - medication requests
  - specimen collection
  - patient transport
  - oxygen requirements
  - mobility status
  - isolation precautions
  - urgency
  - physician orders
  - timing
  - follow-up requirements

3. Vocabulary Selection

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during telephone communication with hospital departments.
- Use authentic clinical and operational vocabulary.

Examples include:

- consultation
- specimen
- transport
- laboratory results
- radiology
- pharmacy
- blood bank
- physician order
- priority
- isolation precautions
- oxygen therapy
- intravenous fluids
- scheduling
- availability
- confirmation

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four clinically legitimate answer choices.
- Exactly one option must be correct.
- The remaining options should also be realistic healthcare vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use clinical reasoning.

The correct answer should reinforce one or more of the following competencies:

- identifying yourself and your unit
- identifying the patient
- stating the purpose of the call
- providing complete information
- communicating urgency
- requesting hospital services
- confirming timelines
- confirming follow-up actions

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used when communicating with hospital departments by telephone.

Every sentence should reinforce clear, accurate, and efficient professional communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should sound like authentic communication used during hospital telephone calls.
- Avoid dictionary definitions or generic examples.

8. Medical Terminology

- Use full clinical terminology rather than abbreviations whenever possible.

Example:

Correct:
"intravenous fluids"

Incorrect:
"IV fluids"

9. Difficulty

- Include a balanced mix of common and moderately difficult clinical and operational vocabulary.
- Require understanding of both the clinical situation and the operational workflow to select the correct answer.

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

Department staff says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic telephone communication between a bedside nurse and another hospital department in hospitals in {{country}}.
- The learner always plays the bedside nurse making or receiving the phone call.
- The AI plays staff from departments such as Radiology, Laboratory, Pharmacy, Blood Bank, Respiratory Therapy, Patient Transport, Nutrition Services, Central Supply, Medical Records, or Admissions.
- Every situation should involve requesting a service, providing patient information, clarifying operational details, confirming scheduling, discussing urgency, or confirming follow-up actions.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during interdepartmental phone calls.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following competencies:
  - identifying yourself, your department, and the patient
  - stating the purpose of the call clearly
  - providing relevant clinical and operational information
  - communicating urgency appropriately
  - clarifying requests or departmental procedures
  - confirming responsibilities, timelines, and follow-up actions

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two or more responses that an experienced nurse could realistically say.
- The learner must identify the MOST professional, concise, collaborative, and clinically appropriate response.

The correct response should demonstrate one or more of the following:

- introduces the nurse, unit, and patient clearly
- explains the reason for the call promptly
- provides complete patient or request information
- communicates urgency appropriately
- clarifies important operational details
- confirms appointment times or service availability
- repeats important instructions or timelines
- confirms follow-up responsibilities before ending the call

Incorrect responses should be plausible but less appropriate because they:

- omit important patient information
- provide incomplete request details
- fail to explain urgency
- fail to clarify timelines
- fail to confirm departmental instructions
- communicate less efficiently

5. Scenario Variety

Include a balanced mix of situations involving:

- requesting CT or MRI appointments
- following up on laboratory results
- requesting blood products
- arranging patient transport
- medication requests with Pharmacy
- respiratory therapy referrals
- scheduling diagnostic procedures
- specimen collection
- equipment requests
- interpreter services
- discharge coordination
- dietary requests
- isolation precautions
- confirming physician orders
- urgent service requests

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, and professional communication during telephone conversations with other hospital departments.

Every option should sound like something a healthcare professional could realistically say.

The correct answer must be unambiguously the best response for the specific situation.

Return a JSON array:

[
  {
    "respondentName": "{{Department Staff Name}}",
    "department": "{{Department}}",
    "prompt": "{{What the department staff says}}",
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

- Create 2–3 connected scenes that reflect realistic telephone communication between a nurse and other hospital departments in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the bedside nurse making or receiving the phone call.
- The AI should play staff from other hospital departments such as Radiology, Laboratory, Pharmacy, Blood Bank, Respiratory Therapy, Central Supply, Transport Services, Admissions, Environmental Services, Nutrition Services, or Medical Records.
- The scenario should progress naturally from introducing yourself, identifying the patient or request, explaining the purpose of the call, providing the required information, discussing logistics or urgency, and confirming the agreed actions before ending the call.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for hospital staff in {{country}}.

Examples:
- Rachel Green (Radiology Coordinator)
- James Wilson (Laboratory Technologist)
- Emily Carter (Pharmacist)
- Michael Davis (Patient Transport Coordinator)
- Sarah Chen (Respiratory Therapist)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during professional telephone conversations between hospital departments.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Clearly identifies themselves, their department or unit, and the patient or service request.
- States the purpose of the call promptly and concisely.
- Provides all relevant information needed to process the request, including patient details, urgency, timing, and important clinical information.
- Confirms that the request has been understood, clarifies responsibilities, expected timelines, and required follow-up before ending the call.

5. Realism

Include realistic phone conversations involving situations such as:

- scheduling a CT scan or MRI
- requesting laboratory tests
- following up on pending laboratory results
- arranging patient transport
- requesting blood products
- contacting pharmacy about medications
- requesting respiratory therapy
- ordering medical equipment
- arranging interpreter services
- coordinating patient discharge
- requesting dietary changes
- clarifying imaging appointments
- requesting environmental cleaning after isolation
- confirming specimen collection

Include realistic information such as:

- patient identification
- diagnosis
- reason for request
- urgency level
- allergies
- mobility status
- infection precautions
- oxygen requirements
- scheduled procedures
- physician orders
- timing requirements
- location
- operational constraints

Some information should require the learner to clarify timelines, repeat important information, or confirm departmental procedures.

6. Learning Objective

The learner should develop automatic, confident, and professional communication when speaking with other hospital departments by telephone.

The learner should naturally practise:

- introducing themselves and their unit
- identifying the patient or service request
- stating the reason for the call clearly
- providing complete and relevant information
- communicating urgency appropriately
- asking clarification questions
- confirming timelines, responsibilities, and follow-up actions before ending the call

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Department Staff Name}}"
  ],
  "context": "{{Brief description of the telephone communication scenario}}",
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
	phone_patient_families: {
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
- If additional words are needed, supplement with vocabulary commonly used during telephone conversations with patients' families.
- Every word must clearly contain the target phoneme.
- Do not repeat words.
- Use authentic clinical and communication vocabulary commonly spoken during telephone conversations with patients' families.

Examples include:

- confidentiality
- authorisation
- identity
- representative
- physician
- diagnosis
- prognosis
- rehabilitation
- discharge planning
- follow-up
- medication
- treatment plan
- consent
- privacy
- recovery
- condition
- laboratory results
- imaging results
- appointment
- reassurance

3. Clinical Context

- Every sentence should sound like authentic telephone communication between a bedside nurse and a patient's family member in hospitals in {{country}}.
- Avoid textbook examples or isolated vocabulary.
- Every sentence should naturally reflect conversations about patient care while maintaining professional boundaries.
- Include realistic situations such as:
  - verifying the caller's identity
  - confirming authorisation
  - providing appropriate patient updates
  - explaining confidentiality
  - discussing nursing care
  - explaining medications
  - discussing rehabilitation or discharge planning
  - referring questions to the physician
  - explaining follow-up appointments
  - responding to emotional family members
  - protecting patient privacy

Examples:

- "Before I discuss your father's condition, could you confirm your full name and your relationship to him?"
- "I'm authorised to provide an update on today's nursing care, but the physician will discuss the treatment plan."
- "For privacy reasons, I need to verify that you're the authorised contact."
- "I'll let the physician know that you would like a call as soon as possible."

4. Competency Alignment

The selected words and sentences should reinforce the learner's ability to:

- verify the caller's identity
- confirm authorisation
- communicate clearly using language families can understand
- demonstrate empathy and professionalism
- protect patient confidentiality
- explain professional boundaries appropriately
- refer callers to the appropriate healthcare professional
- confirm follow-up actions before ending the call

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult clinical terminology.
- Include words from different communication categories, including:
  - patient privacy
  - confidentiality
  - family communication
  - diagnosis
  - medications
  - rehabilitation
  - discharge planning
  - follow-up
  - professional communication
  - patient support

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "word": "{{clinical word}}",
    "sentence": "{{natural telephone conversation sentence}}"
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
{{fill_blank_evidence}}

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

- Every sentence should describe a realistic telephone conversation between a bedside nurse and a patient's family member or authorised representative in a hospital in {{country}}.
- The sentence should sound like something a nurse would naturally say during a phone call with a patient's family.
- Replace only the target vocabulary with the blank.
- Every sentence should contain enough clinical context that only one answer is correct.
- Include realistic details such as:
  - verifying the caller's identity
  - confirming authorisation
  - discussing the patient's current condition
  - medications
  - nursing care
  - pending laboratory or imaging results
  - discharge planning
  - rehabilitation
  - physician updates
  - follow-up appointments
  - visiting arrangements
  - patient confidentiality
  - referrals to the physician

3. Vocabulary Selection

- Begin with the student's weak words ({{fill_blank_evidence}}).
- If fewer than 10 words are provided, supplement with vocabulary commonly used during telephone communication with patients' families.
- Use authentic clinical and communication vocabulary.

Examples include:

- confidentiality
- authorisation
- identity
- diagnosis
- prognosis
- physician
- treatment plan
- rehabilitation
- discharge planning
- follow-up
- medication
- consent
- privacy
- authorised representative
- patient information

Do not repeat vocabulary.

4. Realistic Answer Choices

- Provide four clinically legitimate answer choices.
- Exactly one option must be correct.
- The remaining options should also be realistic healthcare vocabulary.
- Avoid obviously incorrect or unrelated words.
- At least half of the questions should contain multiple plausible options so the learner must use clinical reasoning.

The correct answer should reinforce one or more of the following competencies:

- verifying identity
- confirming authorisation
- providing appropriate patient information
- communicating clearly
- protecting confidentiality
- explaining professional boundaries
- referring callers appropriately
- confirming follow-up actions

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen recognition and understanding of vocabulary commonly used during telephone conversations with patients' families while maintaining professional communication and patient confidentiality.

Every sentence should reinforce safe, compassionate, and professional communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- Replace only the target vocabulary.
- Every sentence should sound like authentic telephone communication used in hospitals.
- Avoid dictionary definitions or generic examples.

8. Medical Terminology

- Use full clinical terminology rather than abbreviations whenever possible.

Example:

Correct:
"authorised representative"

Incorrect:
"authorised rep"

9. Difficulty

- Include a balanced mix of common and moderately difficult clinical and communication vocabulary.
- Require understanding of both the clinical situation and confidentiality requirements to identify the correct answer.

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

Caller says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic telephone communication between a bedside nurse and a patient's family member or authorised representative in hospitals in {{country}}.
- The learner always plays the bedside nurse answering or making the phone call.
- The AI plays a family member, friend, spouse, parent, child, or authorised representative calling about a patient.
- Every situation should involve verifying identity, confirming authorisation, providing appropriate patient updates, responding to concerns, maintaining confidentiality, or explaining the next steps.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during telephone conversations with patients' families.

3. Important Requirements

- Every correct answer must naturally include one or more phrases from {{missed_phrases}} whenever appropriate.
- Every scenario should reinforce one or more of the following competencies:
  - verifying the caller's identity
  - confirming authorisation before discussing patient information
  - providing accurate information within the nurse's scope of practice
  - communicating clearly without unnecessary medical jargon
  - demonstrating empathy and professionalism
  - maintaining confidentiality
  - referring callers to the physician or appropriate healthcare provider when necessary
  - explaining follow-up actions

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two or more responses that a professional nurse could realistically say.
- The learner must identify the MOST professional, compassionate, and clinically appropriate response.

The correct response should demonstrate one or more of the following:

- verifies the caller's identity before discussing the patient
- confirms authorisation appropriately
- provides accurate information within the nurse's scope
- explains confidentiality professionally
- responds with empathy
- avoids speculation
- refers medical decisions or prognosis to the physician
- clearly explains the next steps

Incorrect responses should be plausible but less appropriate because they:

- disclose information before verifying authorisation
- speculate about the patient's condition or prognosis
- use unnecessary medical jargon
- fail to acknowledge the caller's concerns
- fail to protect confidentiality
- omit appropriate referrals or follow-up information

5. Scenario Variety

Include a balanced mix of situations involving:

- requests for updates on the patient's condition
- surgery or procedure questions
- medication questions
- prognosis questions
- discharge planning
- rehabilitation updates
- visiting arrangements
- pending laboratory or imaging results
- emotional family members
- requests from unauthorised callers
- physician availability
- follow-up appointments
- home care questions
- patient privacy concerns
- care coordination after discharge

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to develop automatic, confident, compassionate, and professional telephone communication with patients' families.

Every option should sound like something a professional nurse could realistically say.

The correct answer must be unambiguously the best response for the specific situation.

Return a JSON array:

[
  {
    "respondentName": "{{Caller Name}}",
    "relationship": "{{Relationship to Patient}}",
    "prompt": "{{What the caller says}}",
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

- Create 2–3 connected scenes that reflect realistic telephone conversations between a bedside nurse and a patient's family member or authorised representative in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same communication skills in a new clinical situation.
- The student always plays the bedside nurse answering or making the phone call.
- The AI should play one or more family members, friends, or authorised representatives calling to ask about a patient's condition or care.
- The scenario should progress naturally from answering the call, verifying the caller's identity and authorisation, discussing appropriate information, responding to concerns, and explaining the next steps before ending the conversation.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for hospitals in {{country}}.

Examples:
- Emily Carter (Daughter)
- David Miller (Son)
- Sarah Wilson (Spouse)
- James Brown (Brother)
- Rachel Kim (Authorised Representative)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during telephone conversations between nurses and patients' families.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Verifies the identity of the caller and confirms they are authorised to receive patient information before discussing the patient's care.
- Provides accurate, appropriate, and understandable information within the nurse's scope of practice.
- Demonstrates empathy by listening actively, acknowledging concerns, and communicating calmly, respectfully, and professionally.
- Protects patient confidentiality, sets appropriate boundaries when information cannot be shared, and clearly explains follow-up actions or referrals when additional information is needed.

5. Realism

Include realistic telephone conversations involving situations such as:

- requests for updates on a patient's condition
- questions after surgery
- medication concerns
- discharge planning
- rehabilitation updates
- visiting arrangements
- pending laboratory or imaging results
- concerns after a sudden deterioration
- emotional family members
- requests from unauthorised callers
- requests for physician updates
- follow-up appointments
- care coordination after discharge

Include realistic clinical information such as:

- patient identification
- diagnosis
- current condition
- nursing care
- medications
- physician updates
- pending investigations
- rehabilitation plans
- discharge planning
- safety precautions
- follow-up appointments

Some situations should require the learner to politely decline sharing confidential information, verify authorisation, or refer the caller to the physician or another appropriate healthcare professional.

6. Learning Objective

The learner should develop automatic, confident, compassionate, and professional telephone communication with patients' families.

The learner should naturally practise:

- verifying the caller's identity and authorisation
- providing appropriate patient updates
- communicating clearly without unnecessary medical jargon
- responding empathetically to concerns
- protecting patient confidentiality
- explaining professional boundaries
- referring questions appropriately
- confirming the next steps before ending the call

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{Family Member Name}}"
  ],
  "context": "{{Brief description of the telephone conversation}}",
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
	conducting_cpr: {
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
- If additional words are needed, supplement with vocabulary commonly used within the selected mission and topic.
- Every word must clearly contain the target phoneme.
- Do not repeat the same word.
- Use vocabulary that nurses commonly pronounce during real patient care.

3. Clinical Context

- Every sentence must sound like authentic communication in hospitals in {{country}}.
- Avoid textbook examples or dictionary definitions.
- The sentence should naturally reflect the selected mission and topic.
- Use realistic patient names, symptoms, medications, procedures, equipment, or healthcare professionals where appropriate.
- The pronunciation practice should reinforce professional nursing communication rather than isolated vocabulary.

4. Competency Alignment

The selected words and sentences should naturally reinforce the learner's ability to:
- Recognizes cardiac arrest and patient deterioration quickly, identifying critical signs such as unresponsiveness, absent pulse, respiratory failure, or sudden collapse.
- Initiates immediate emergency response, including activating Code Blue, starting high-quality CPR, providing oxygen, and preparing defibrillation.
- Communicates CPR instructions clearly and calmly, giving concise, professional directions while maintaining leadership during emergencies.
- Uses accurate ICU and CPR terminology, applying appropriate clinical language throughout emergency assessment and treatment.

The learner should repeatedly practise vocabulary that would naturally be spoken while demonstrating these competencies.

5. Difficulty

- Include a balanced mix of common nursing vocabulary and moderately difficult medical terminology.
- Include words from different clinical categories such as:
  - symptoms
  - assessments
  - medications
  - procedures
  - medical equipment
  - professional communication
- Avoid extremely rare medical terminology unless it is directly relevant to the selected topic.

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
- Competencies: {{fill_blank_evidence}}
- The student struggled with these words this week: {{fill_blank_evidence}}

The goal is to strengthen the learner's clinical vocabulary while reinforcing the communication competencies required for this topic.

Generate 10-15 fill-in-the-blank questions according to the following rules.

1. Vocabulary Selection

- Use the student's weak words: {{fill_blank_evidence}}.
- If fewer than 10 words are provided, create more sentences for the weak words to be used in.
- Every vocabulary item must be directly relevant to the topic.
- Prioritize vocabulary that nurses actively use during patient care, communication, assessment, documentation, and collaboration.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.

2. Competency Alignment

The vocabulary should naturally reinforce the following competencies:

{{fill_blank_evidence}}

Every question should require vocabulary that supports one or more of these competencies.

For example, vocabulary may relate to:

- patient assessment
- recognizing deterioration
- emergency interventions
- medications
- monitoring
- procedures
- patient education
- communication with physicians or nurses
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
- Every sentence must describe a realistic clinical situation in a hospital in {{country}}.
- Include sufficient clinical context such as:
  - patient symptoms
  - vital signs
  - medications
  - laboratory results
  - physician orders
  - nursing interventions
  - medical equipment
  - procedures
- The sentence should contain enough information that only one answer is clinically appropriate.
- Avoid dictionary-style definitions or generic example sentences.
- The sentence should sound like something a nurse would hear, say, document, or read during routine clinical practice.

4. Answer Options

- Provide four answer choices.
- Exactly one option must be correct.
- All incorrect options must be legitimate clinical vocabulary.
- Incorrect options should be plausible but clearly incorrect for the specific clinical situation because of:
  - incorrect assessment
  - incorrect intervention
  - incorrect procedure
  - incorrect equipment
  - incorrect medication
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
"intravenous line"

Incorrect:
"IV line"

- Use terminology commonly used by nurses in {{country}}.

6. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

7. Learning Objective

The learner's objective is to strengthen recognition and understanding of emergency and critical-care vocabulary while improving clinical communication during high-pressure situations.

- Every option must be authentic medical vocabulary.
- The correct answer must be unambiguously correct for the specific clinical situation.
- Incorrect answers should be plausible but incorrect because of incorrect assessment, intervention, procedure, equipment, medication, or clinical meaning.
- Every sentence should reflect realistic emergency or ICU scenarios.

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging questions.
- Prioritize clinical reasoning over simple vocabulary recall.
- Ensure the learner must understand the clinical context to identify the correct answer.

9. Output Format

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

- The conversation should reflect a realistic CPR or cardiac arrest situation in a hospital in {{country}}.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication between nurses, physicians, respiratory therapists, rapid response teams, and patients' family members where appropriate.
- Every correct answer must contain at least one authentic phrase from {{missed_phrases}} whenever possible.

3. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically reasonable.
- At least half of the questions should contain two answers that a competent nurse could realistically say.
- The learner must identify the MOST appropriate response based on the clinical situation.

- The correct answer should demonstrate one or more of the following competencies:

- Recognizes cardiac arrest or patient deterioration immediately by identifying signs such as unresponsiveness, absence of pulse, abnormal heart rhythm, respiratory failure, oxygen desaturation, or sudden collapse.
- Initiates immediate high-quality CPR by activating Code Blue, beginning chest compressions, requesting the defibrillator, applying oxygen support, or coordinating the emergency response.
- Gives clear, calm, and direct CPR instructions using concise phrases such as:
  - "Start chest compressions."
  - "Call Code Blue."
  - "Check for a pulse."
  - "Resume CPR."
  - "Everybody clear."
- Uses professional ICU and CPR terminology accurately, including terms such as cardiac arrest, chest compressions, ventricular fibrillation, oxygen saturation, pulse check, airway management, defibrillation, epinephrine, return of spontaneous circulation, and heart rhythm.

4. Balanced Answer Distribution

- Do NOT place all correct answers in the same position.
- Randomly distribute the correct answers across A, B, C, and D.
- The answer pattern should feel unpredictable.

5. Learning Objective

The learner's objective is to develop automatic, confident, and clinically appropriate communication during CPR and cardiac arrest situations through repeated practice in realistic emergency scenarios.

- Every option should sound like something a professional healthcare provider could realistically say.
- The correct answer must be unambiguously the best response for the specific situation.
- Incorrect answers should be plausible but incorrect because of incorrect timing, inappropriate intervention, incomplete assessment, inaccurate clinical information, or poor prioritization—not because they sound unprofessional.
- Every prompt must contain enough clinical detail that only one response is the best choice.

Return a JSON array:

[
  {
    "respondentName": "{{who is speaking to the nurse — e.g. Doctor, Incoming Nurse, Respiratory Therapist, Patient's Family Member}}",
    "prompt": "{{what they say to the nurse}}",
    "correctAnswer": "{{the correct response}}",
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

- Create 2–3 connected scenes that reflect realistic CPR or cardiac arrest situations in a hospital in {{country}}.
- Base the scenario on the student's practiced scenarios ({{practiced_scenarios}}), but do not copy them exactly.
- The learner should apply the same competencies in a new clinical situation.
- The student always plays the nurse.
- The scenario should progress naturally from patient deterioration through emergency intervention to patient stabilization, transfer, or handoff.

2. Characters

- The student character must be named exactly {{student_name}}. Do not invent a different name for the student.
- AI characters must have realistic names appropriate for their roles.
Examples:
  - Dr. James Wilson
  - Sarah Chen
  - Michael Patel
  - Mr. David Thompson
  - Emily Rodriguez
- Never use role titles as names.
- Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete, natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic communication commonly heard during emergencies in hospitals in {{country}}.
- Each scene must contain at least 6 dialogue turns.
- The student must speak at least 3 times per scene.

4. Clinical Competencies

The roleplay should naturally allow the learner to demonstrate the following competencies:

- Recognizes cardiac arrest and patient deterioration immediately by identifying signs such as unresponsiveness, absence of pulse, abnormal heart rhythm, respiratory failure, oxygen desaturation, or sudden collapse.
- Initiates immediate high-quality CPR by activating Code Blue, beginning chest compressions, requesting the defibrillator, applying oxygen support, or coordinating the emergency response.
- Gives clear, calm, and direct CPR instructions using professional emergency communication such as:
  - "Start chest compressions."
  - "Call Code Blue."
  - "Check for a pulse."
  - "Resume CPR."
  - "Everybody clear."
- Uses professional ICU and CPR terminology accurately, including cardiac arrest, chest compressions, ventricular fibrillation, oxygen saturation, pulse check, airway management, defibrillation, epinephrine, return of spontaneous circulation (ROSC), and heart rhythm.

5. Realism

- Include realistic vital signs, monitor alarms, patient deterioration, medication administration, CPR procedures, physician instructions, and multidisciplinary teamwork where appropriate.
- AI characters should ask realistic questions, provide clinical updates, or issue instructions that require the learner to respond professionally.
- Include natural interruptions and rapidly changing patient conditions that reflect real CPR situations.

6. Learning Objective

The learner's objective is to develop automatic, confident, and clinically appropriate communication while participating in CPR and cardiac arrest management.

The roleplay should encourage the learner to:

- recognize deterioration quickly
- communicate effectively during emergencies
- coordinate with the healthcare team
- provide concise patient updates
- use accurate CPR terminology
- remain calm and professional under pressure

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
- Competencies: {{fill_blank_evidence}}
- The student struggled with these words this week: {{fill_blank_evidence}}

The goal is to strengthen the learner's clinical vocabulary while reinforcing the communication competencies required for this topic.

Generate 10-15 fill-in-the-blank questions according to the following rules.

1. Vocabulary Selection

- Use the student's weak words: {{fill_blank_evidence}}.
- If fewer than 10 words are provided, supplement with other vocabulary commonly used during patient discharges.
- Every vocabulary item must be directly relevant to the topic.
- Prioritize vocabulary that nurses actively use during discharge education, medication review, follow-up planning, safety instructions, and patient questions.
- Avoid textbook definitions, isolated vocabulary lists, or generic example sentences.
- Every sentence must contain enough clinical context that only one answer is correct.

2. Competency Alignment

The vocabulary should naturally reinforce the following competencies:

{{fill_blank_evidence}}

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
	grammar: {
		pronunciation: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a grammar pronunciation drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following grammar topics this week:
{{weak_vocabulary}}

The student struggled with the following phonemes this week:
{{weak_phonemes}}

Generate 10–15 pronunciation items according to the following rules:

1. Format

Present each pronunciation item using the following structure:

Sound:
/{{phoneme}}/

Grammar Focus:
{{grammar_topic}}

Sentence:
{{example sentence}}

2. Pronunciation Selection

- Prioritize the student's weak phonemes ({{weak_phonemes}}).
- Generate sentences that naturally reinforce the student's grammar topics ({{weak_vocabulary}}).
- Every sentence must clearly contain one or more target phonemes while also demonstrating correct grammar.
- Do not repeat the same grammar structure excessively.
- Do not repeat sentences.

3. Grammar Focus

Adapt the sentences naturally according to the grammar topic, such as:

- present simple
- present continuous
- past simple
- present perfect
- future forms
- modal verbs
- articles
- prepositions
- conditionals
- passive voice
- reported speech
- question formation
- subject-verb agreement
- countable and uncountable nouns
- relative clauses
- comparative and superlative forms

Do not explain grammar rules.

The learner should reinforce grammar naturally through speaking.

4. Clinical Context

- Every sentence should sound like authentic communication used by nurses in hospitals in {{country}}.
- Avoid isolated vocabulary or textbook examples.
- Every sentence should reflect realistic nursing communication such as:
  - shift handovers
  - patient assessments
  - speaking with doctors
  - answering patients
  - communicating with families
  - medication administration
  - discharge education
  - documenting care
  - emergency situations
  - multidisciplinary discussions

Examples:

- "The patient has been waiting for the physician since this morning."
- "If the patient's temperature increases again, I will notify the doctor immediately."
- "She was transferred to the Intensive Care Unit after the procedure."
- "Have you checked the patient's blood glucose level today?"

5. Competency Alignment

The selected sentences should reinforce the learner's ability to:

- communicate naturally using grammatically correct English
- produce complete and accurate sentences
- speak fluently while maintaining correct grammar
- communicate professionally in common clinical situations

6. Difficulty

- Include a balanced mix of simple and moderately complex sentence structures.
- Use vocabulary commonly spoken by nurses.
- Ensure the learner practises both pronunciation and grammatical accuracy simultaneously.

Return a JSON array:

[
  {
    "sound": "/{{phoneme}}/",
    "grammarFocus": "{{grammar topic}}",
    "sentence": "{{natural clinical sentence}}"
  }
]

Return only valid JSON.
No markdown.
No explanation.`,
		vocabulary: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a grammar fill-in-the-blank drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following grammar topics this week:
{{fill_blank_evidence}}

Generate 10–15 grammar questions according to the following rules:

1. Format

Present each question using the following structure:

Sentence:
{{Sentence containing one blank represented by ______}}

A. {{Option}}

B. {{Option}}

C. {{Option}}

D. {{Option}}

2. Clinical Context

- Every sentence should describe a realistic nursing situation in a hospital in {{country}}.
- The learner should determine the correct answer based primarily on grammar rather than vocabulary.
- The blank may represent a verb, auxiliary verb, article, preposition, modal verb, pronoun, conjunction, or other grammatical element depending on the target grammar.
- Every sentence should contain enough clinical context that only one answer is grammatically and contextually correct.

Include realistic situations such as:

- shift handovers
- patient assessments
- speaking with doctors
- answering patients
- answering families
- medication administration
- discharge education
- documentation
- telephone communication
- emergency situations
- multidisciplinary rounds

3. Grammar Focus

Generate questions based on the student's grammar topics ({{fill_blank_evidence}}).

Examples include:

- present simple
- present continuous
- past simple
- present perfect
- future forms
- modal verbs
- articles
- prepositions
- passive voice
- reported speech
- subject-verb agreement
- conditionals
- question formation
- countable and uncountable nouns
- comparative and superlative forms
- relative clauses

Do not explain grammar rules.

4. Realistic Answer Choices

- Provide four answer choices.
- Exactly one option must be grammatically correct.
- The remaining options should be plausible grammatical alternatives rather than obviously incorrect words.
- At least half of the questions should require careful grammatical reasoning to distinguish between multiple plausible answers.

Examples of distractors include:

- different verb tenses
- different auxiliary verbs
- similar prepositions
- articles
- modal verbs
- pronouns
- conjunctions

Do not include spelling mistakes or nonsense words.

5. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C and D.
- Do not follow a predictable pattern.

6. Learning Objective

The learner should strengthen grammatical accuracy while reading and producing professional nursing English.

The learner should improve their ability to recognise correct grammar within realistic healthcare communication.

7. Sentence Design

- Every question must contain exactly one blank represented by "______".
- The blank should test grammar, not vocabulary knowledge.
- Every sentence should sound like authentic communication used in hospitals.
- Avoid textbook examples and isolated grammar exercises.

Examples:

- "The physician ______ already reviewed the laboratory results before morning rounds."
- "If the patient's blood pressure falls again, we ______ notify the doctor immediately."
- "She ______ caring for postoperative patients since the beginning of her shift."
- "The medication was administered ______ the physician's order."

8. Difficulty

- Include a balanced mix of straightforward and moderately challenging grammar questions.
- Require learners to understand both the grammar and the clinical context to identify the correct answer.

Return a JSON array:

[
  {
    "grammarFocus": "{{grammar topic}}",
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
No explanation.`,
		key_phrases: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a grammar key phrases drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student struggled with the following grammar topics this week:
{{weak_vocabulary}}

Generate 10–15 key phrase questions according to the following rules:

1. Format

Present each question using the following structure:

Respondent says:
"{{Question or comment}}"

You say:

A. {{Response}}

B. {{Response}}

C. {{Response}}

D. {{Response}}

2. Clinical Context

- Every conversation should reflect realistic communication in hospitals in {{country}}.
- The learner always plays the nurse.
- The AI may play a doctor, nurse, patient, family member, pharmacist, therapist, or another healthcare professional.
- Adapt the conversations naturally according to the target grammar topic ({{weak_vocabulary}}).
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic healthcare communication commonly heard in hospitals.

3. Grammar Focus

- Every question should require the learner to recognise the response with the most grammatically accurate and natural English.
- The grammar should be reinforced through realistic communication rather than explicit grammar instruction.
- Depending on {{weak_vocabulary}}, focus on grammar such as:
  - verb tenses
  - articles
  - prepositions
  - modal verbs
  - passive voice
  - reported speech
  - question formation
  - subject-verb agreement
  - conditionals
  - relative clauses
  - comparative structures
  - countable and uncountable nouns

4. Realistic Answer Choices

Do NOT make the incorrect answers obviously wrong.

Instead:

- Make all four responses clinically appropriate.
- At least half of the questions should contain two or more responses that a nurse could realistically say.
- Only one response should be grammatically correct, the most natural, and the most appropriate for the situation.

Incorrect answers should remain realistic but contain subtle grammar mistakes such as:

- incorrect tense
- incorrect article usage
- incorrect preposition
- incorrect word order
- incorrect modal verb
- subject-verb disagreement
- incorrect conditional structure
- incorrect reported speech
- incorrect question formation

Do not create spelling mistakes or unnatural sentences.

5. Scenario Variety

Include a balanced mix of conversations involving:

- shift handovers
- speaking with doctors
- multidisciplinary rounds
- answering patients
- answering family members
- medication administration
- telephone communication
- discharge education
- emergency situations
- documenting patient care

6. Balanced Answer Distribution

- Randomly distribute the correct answers across A, B, C, and D.
- Do not follow a predictable answer pattern.

7. Learning Objective

The learner's objective is to improve grammatical accuracy while communicating naturally in professional nursing situations.

Every option should sound like something a nurse could realistically say.

The correct answer must be the only response that is both grammatically correct and professionally appropriate.

Return a JSON array:

[
  {
    "respondentName": "{{Speaker Name}}",
    "role": "{{Speaker Role}}",
    "grammarFocus": "{{grammar topic}}",
    "prompt": "{{What the speaker says}}",
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
No explanation.`,
		roleplay: `You are a clinical English language coach for Korean nurses in {{country}}.

Generate a grammar roleplay drill based on the following:

- Mission: {{mission}}
- Topic: {{topic}}

The student practiced the following grammar topics this week:
{{weak_vocabulary}}

Generate a multi-scene roleplay according to the following rules:

1. Scenario Design

- Create 2–3 connected scenes that reflect realistic communication in a hospital in {{country}}.
- The roleplay should naturally require the learner to use the target grammar rather than explicitly teaching grammar rules.
- Base the scenario on the student's practiced grammar topics ({{weak_vocabulary}}), but do not copy previous scenarios exactly.
- The learner should demonstrate correct grammar while communicating professionally in authentic nursing situations.
- The student always plays the nurse.
- The AI may play patients, nurses, doctors, family members, or other healthcare professionals depending on the scenario.
- The conversation should progress naturally toward a clear clinical outcome.

2. Characters

- Name the student using student_character_name.
- AI characters must have realistic names appropriate for hospitals in {{country}}.

Examples:
- Sarah Johnson (Charge Nurse)
- Michael Patel (Physician)
- Emily Carter (Patient)
- James Wilson (Patient's Son)

Characters should naturally address each other by name whenever appropriate.

3. Dialogue Requirements

- Every dialogue line must be a complete natural sentence.
- Never use blanks, placeholders, or bracketed text.
- Avoid textbook language, scripted dialogue, robotic communication, and overly formal wording.
- Use authentic healthcare communication commonly heard in hospitals in {{country}}.
- Each scene must contain at least 8 dialogue turns.
- The student must speak at least 4 times per scene.
- The target grammar should appear naturally throughout the dialogue without drawing attention to it.

4. Grammar Focus

- The dialogue should create multiple opportunities for the learner to use the target grammar correctly.
- Depending on {{topic}}, this may include:
  - verb tenses
  - articles
  - prepositions
  - modal verbs
  - conditionals
  - question formation
  - reported speech
  - passive voice
  - subject-verb agreement
  - countable and uncountable nouns
  - comparative structures
  - relative clauses

- Do not explain grammar rules during the roleplay.
- The emphasis should be on natural communication rather than explicit grammar instruction.

5. Clinical Context

Include realistic nursing situations such as:

- shift handovers
- speaking with doctors
- speaking with patients
- answering families' questions
- giving discharge instructions
- medication administration
- documenting patient care
- responding to emergencies
- telephone communication
- multidisciplinary rounds

6. Learning Objective

The learner should develop automatic, grammatically accurate spoken English while communicating naturally in professional nursing situations.

The learner should practise:

- speaking fluently without focusing consciously on grammar
- using correct grammar naturally in context
- communicating clearly and professionally
- responding confidently in realistic clinical conversations

7. Output Format

Return only valid JSON.

{
  "student_character_name": "{{student_name}}",
  "ai_character_names": [
    "{{AI Character Name}}"
  ],
  "context": "{{Brief scenario description}}",
  "grammar_focus": "{{target grammar}}",
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
No explanation.`,
	},
};
