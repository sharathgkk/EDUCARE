import type {
  AccessibilityPref,
  Assignment,
  ContrastPreset,
  DisabilityProfile,
  ExamQuestion,
  LanguageCode,
  RecordedLesson,
  SignLesson,
  StudyMaterial,
} from '../types';

export interface ContrastPresetMeta {
  id: ContrastPreset;
  label: string;
  description: string;
  swatchBg: string;
  swatchFg: string;
  swatchBorder: string;
}

export const CONTRAST_PRESETS: ContrastPresetMeta[] = [
  {
    id: 'default',
    label: 'Default',
    description: 'Standard EduCare Light or Dark appearance.',
    swatchBg: '#F1F6FC',
    swatchFg: '#153B70',
    swatchBorder: '#CBD5E1',
  },
  {
    id: 'soft-blue',
    label: 'Soft Blue',
    description: 'Low-glare gentle blue surfaces for comfortable reading.',
    swatchBg: '#E6F0FA',
    swatchFg: '#0F2A4D',
    swatchBorder: '#7AA7D9',
  },
  {
    id: 'high-contrast-dark',
    label: 'High Contrast Dark',
    description: 'Crisp white & cyan text on deep charcoal-black backgrounds.',
    swatchBg: '#05070B',
    swatchFg: '#FFFFFF',
    swatchBorder: '#7DD3FC',
  },
  {
    id: 'yellow-on-black',
    label: 'Yellow on Black',
    description: 'Maximum low-vision contrast with vivid yellow on pure black.',
    swatchBg: '#000000',
    swatchFg: '#FDE047',
    swatchBorder: '#FACC15',
  },
  {
    id: 'dyslexia-pastel',
    label: 'Dyslexia Pastel',
    description: 'Warm cream pastel with softer ink and wider letter spacing.',
    swatchBg: '#FAF1DC',
    swatchFg: '#2B251D',
    swatchBorder: '#C8B184',
  },
];

export interface DisabilitySupportOption {
  id: DisabilityProfile;
  funnyTitle: string;
  clearLabel: string;
  tagline: string;
  recommendedPref: AccessibilityPref;
}

export const DISABILITY_SUPPORT_OPTIONS: DisabilitySupportOption[] = [
  {
    id: 'standard',
    funnyTitle: 'Classic Knowledge Seeker',
    clearLabel: 'Everyday Mode',
    tagline: 'No extra gadgets needed right now — just pure curiosity and brainpower.',
    recommendedPref: 'standard',
  },
  {
    id: 'deaf',
    funnyTitle: 'Super-Sonic Hearing',
    clearLabel: 'Visual, Captions & Sign',
    tagline: 'Who needs background noise anyway? Live captions, visual flashes & Sign Language ON.',
    recommendedPref: 'standard',
  },
  {
    id: 'blind',
    funnyTitle: 'Master of Shadows',
    clearLabel: 'Audio & High Contrast',
    tagline: 'Eyes are optional when you have audio superpowers. Bigger text & Read-Aloud ready.',
    recommendedPref: 'large-text',
  },
  {
    id: 'no-hands',
    funnyTitle: 'Look Ma, No Hands!',
    clearLabel: 'Voice & Hands-Free',
    tagline: 'Keyboards are overrated — voice commands, giant tiles & hands-free control activated.',
    recommendedPref: 'voice-nav',
  },
  {
    id: 'ocd',
    funnyTitle: 'High-Energy Fingers',
    clearLabel: 'Calm & Structured Flow',
    tagline: 'Everything neat, symmetrical, predictable, and zero chaos — just how it should be.',
    recommendedPref: 'standard',
  },
  {
    id: 'stammering',
    funnyTitle: 'Secret Code Linguist',
    clearLabel: 'Type-to-Speak & Zero-Rush',
    tagline: 'Take all the time you need — or let Type-to-Speak and quick phrases drop the mic.',
    recommendedPref: 'standard',
  },
];

export interface TranslationBundle {
  welcomeTitle: string;
  welcomeSubtitle: string;
  navHome: string;
  navClasses: string;
  navMaterials: string;
  navTutor: string;
  navAccess: string;
  navSign: string;
  navExam: string;
  navTeacher: string;
  onlineClassesTitle: string;
  onlineClassesDesc: string;
  aiTutorTitle: string;
  aiTutorDesc: string;
  eyeControlTitle: string;
  eyeControlDesc: string;
  signLanguageTitle: string;
  signLanguageDesc: string;
  offlineLearningTitle: string;
  offlineLearningDesc: string;
  onlineExamTitle: string;
  onlineExamDesc: string;
}

export const TRANSLATIONS: Record<LanguageCode, TranslationBundle> = {
  en: {
    welcomeTitle: 'Welcome to EduCare!',
    welcomeSubtitle:
      'An inclusive learning platform designed for students with physical disabilities and health conditions.',
    navHome: 'Home',
    navClasses: 'Classes',
    navMaterials: 'Materials',
    navTutor: 'AI Tutor',
    navAccess: 'Accessibility',
    navSign: 'Sign Language',
    navExam: 'Examination',
    navTeacher: 'Teacher',
    onlineClassesTitle: 'Online Classes',
    onlineClassesDesc: 'Attend live or recorded lessons comfortably from home or hospital.',
    aiTutorTitle: 'AI Personal Tutor',
    aiTutorDesc: 'Get simple, screen-reader-friendly explanations for difficult subjects.',
    eyeControlTitle: 'Accessibility & Eye Control',
    eyeControlDesc: 'Explore voice navigation, large text, and hands-free camera preview.',
    signLanguageTitle: 'Sign Language',
    signLanguageDesc: 'Explore visual sign language guides with step-by-step demonstrations.',
    offlineLearningTitle: 'Offline Learning',
    offlineLearningDesc: 'Download study notes as plain text files for reliable offline study.',
    onlineExamTitle: 'Online Exam',
    onlineExamDesc: 'Practice accessible examinations with read-aloud and extra time options.',
  },
  kn: {
    welcomeTitle: 'EduCare ಗೆ ಸ್ವಾಗತ!',
    welcomeSubtitle:
      'ದೈಹಿಕ ಅಸಮರ್ಥತೆ ಮತ್ತು ಆರೋಗ್ಯ ಸಮಸ್ಯೆಗಳಿರುವ ವಿದ್ಯಾರ್ಥಿಗಳಿಗಾಗಿ ರೂಪಿಸಲಾದ ಸಮಗ್ರ ಕಲಿಕಾ ವೇದಿಕೆ.',
    navHome: 'ಮುಖಪುಟ',
    navClasses: 'ತರಗತಿಗಳು',
    navMaterials: 'ಅಧ್ಯಯನ ಸಾಮಗ್ರಿ',
    navTutor: 'AI ಬೋಧಕ',
    navAccess: 'ಸುಲಭ ಲಭ್ಯತೆ',
    navSign: 'ಸಂಕೇತ ಭಾಷೆ',
    navExam: 'ಪರೀಕ್ಷೆ',
    navTeacher: 'ಶಿಕ್ಷಕರು',
    onlineClassesTitle: 'ಆನ್ಲೈನ್ ತರಗತಿಗಳು',
    onlineClassesDesc: 'ಮನೆ ಅಥವಾ ಆಸ್ಪತ್ರೆಯಿಂದಲೇ ನೇರ ಮತ್ತು ರೆಕಾರ್ಡ್ ಮಾಡಿದ ತರಗತಿಗಳಿಗೆ ಹಾಜರಾಗಿ.',
    aiTutorTitle: 'AI ವೈಯಕ್ತಿಕ ಬೋಧಕ',
    aiTutorDesc: 'ಕಠಿಣ ವಿಷಯಗಳಿಗೆ ಸರಳ ಮತ್ತು ಸ್ಪಷ್ಟ ವಿವರಣೆಗಳನ್ನು ಪಡೆಯಿರಿ.',
    eyeControlTitle: 'ಕಣ್ಣಿನ ನಿಯಂತ್ರಣ ಮತ್ತು ಸುಲಭತೆ',
    eyeControlDesc: 'ಧ್ವನಿ ನ್ಯಾವಿಗೇಷನ್, ದೊಡ್ಡ ಅಕ್ಷರಗಳು ಮತ್ತು ಕ್ಯಾಮೆರಾ ಪೂರ್ವವೀಕ್ಷಣೆ ಬಳಸಿ.',
    signLanguageTitle: 'ಸಂಕೇತ ಭಾಷೆ',
    signLanguageDesc: 'ದೃಶ್ಯ ಸಂಕೇತ ಭಾಷಾ ಪಾಠಗಳನ್ನು ಹಂತ ಹಂತವಾಗಿ ಕಲಿಯಿರಿ.',
    offlineLearningTitle: 'ಆಫ್‌ಲೈನ್ ಕಲಿಕೆ',
    offlineLearningDesc: 'ಇಂಟರ್ನೆಟ್ ಇಲ್ಲದಿದ್ದರೂ ಓದಲು ಅಧ್ಯಯನ ಟಿಪ್ಪಣಿಗಳನ್ನು ಡೌನ್‌ಲೋಡ್ ಮಾಡಿ.',
    onlineExamTitle: 'ಆನ್‌ಲೈನ್ ಪರೀಕ್ಷೆ',
    onlineExamDesc: 'ಧ್ವನಿ ಓದುವಿಕೆ ಮತ್ತು ಹೆಚ್ಚುವರಿ ಸಮಯದೊಂದಿಗೆ ಅಭ್ಯಾಸ ಪರೀಕ್ಷೆಗಳನ್ನು ಬರೆಯಿರಿ.',
  },
  hi: {
    welcomeTitle: 'EduCare में आपका स्वागत है!',
    welcomeSubtitle:
      'शारीरिक दिव्यांगता और स्वास्थ्य स्थितियों वाले छात्रों के लिए डिज़ाइन किया गया समावेशी शिक्षण मंच।',
    navHome: 'होम',
    navClasses: 'कक्षाएं',
    navMaterials: 'अध्ययन सामग्री',
    navTutor: 'AI शिक्षक',
    navAccess: 'सुगम्यता',
    navSign: 'सांकेतिक भाषा',
    navExam: 'परीक्षा',
    navTeacher: 'शिक्षक',
    onlineClassesTitle: 'ऑनलाइन कक्षाएं',
    onlineClassesDesc: 'घर या अस्पताल से आसानी से लाइव और रिकॉर्डेड कक्षाओं में भाग लें।',
    aiTutorTitle: 'AI व्यक्तिगत शिक्षक',
    aiTutorDesc: 'कठिन विषयों के लिए सरल और स्पष्ट व्याख्या प्राप्त करें।',
    eyeControlTitle: 'सुगम्यता और आई कंट्रोल',
    eyeControlDesc: 'वॉयस नेविगेशन, बड़े टेक्स्ट और कैमरा पूर्वावलोकन का उपयोग करें।',
    signLanguageTitle: 'सांकेतिक भाषा',
    signLanguageDesc: 'दृश्य प्रदर्शनों के साथ बुनियादी सांकेतिक भाषा सीखें।',
    offlineLearningTitle: 'ऑफलाइन अध्ययन',
    offlineLearningDesc: 'ऑफलाइन पढ़ने के लिए अध्ययन नोट्स डाउनलोड करें।',
    onlineExamTitle: 'ऑनलाइन परीक्षा',
    onlineExamDesc: 'बोलकर सुनाने और अतिरिक्त समय विकल्पों के साथ अभ्यास परीक्षा दें।',
  },
};

export const INITIAL_MATERIALS: StudyMaterial[] = [
  {
    id: 'mat-daredevil-audio',
    title: 'Audio-First Python & Screen Reader Guide',
    subject: 'Computer Science',
    readTime: '4 min read',
    uploadedBy: 'Dr. Vikram Rao',
    targetProfiles: ['blind'],
    createdAt: '2026-11-15',
    content:
      'Designed specifically for Master of Shadows learners using audio navigation and high-contrast displays.\n\nKey Concepts:\n1. Clean Indentation Cues: Python blocks use consistent spaces so screen readers announce structure clearly.\n2. Spoken Functions: Define reusable steps with def and read each parameter aloud.\n3. Audio Math Tip: Break equations into left-hand and right-hand spoken phrases before solving.',
  },
  {
    id: 'mat-deaf-visual',
    title: 'Visual Java Blueprint & Sign-Friendly Glossary',
    subject: 'Computer Science',
    readTime: '4 min read',
    uploadedBy: 'Ananya Verma',
    targetProfiles: ['deaf'],
    createdAt: '2026-11-14',
    content:
      'Designed for Super-Sonic Hearing learners with crisp visual structure and caption-ready summaries.\n\nKey Concepts:\n1. Classes & Objects: Think of a Class as a visual diagram and an Object as the finished model.\n2. Encapsulation: Keep data safely grouped inside one labeled container.\n3. Visual Keywords: Highlight public, class, and return as visual landmarks while reading code.',
  },
  {
    id: 'mat-handsfree-voice',
    title: 'Voice-First Coding & Hands-Free Study Shortcuts',
    subject: 'Computer Science',
    readTime: '3 min read',
    uploadedBy: 'Prof. Rohan Kulkarni',
    targetProfiles: ['no-hands'],
    createdAt: '2026-11-13',
    content:
      'Designed for Look Ma, No Hands! learners using voice commands and hands-free controls.\n\nKey Concepts:\n1. Voice Navigation: Say Classes, Materials, Tutor, or Exam to jump directly without typing.\n2. Dictated Answers: Use microphone input in the AI Tutor to ask follow-up questions.\n3. Short Spoken Blocks: Break code logic into clear single-sentence instructions.',
  },
  {
    id: 'mat-ocd-structured',
    title: 'Step-by-Step Algebra — Zero-Chaos Checklist',
    subject: 'Mathematics',
    readTime: '5 min read',
    uploadedBy: 'Dr. Kavita Menon',
    targetProfiles: ['ocd'],
    createdAt: '2026-11-14',
    content:
      'Designed for High-Energy Fingers learners with a calm, predictable 3-step structure.\n\nStep 1: Write the equation neatly with one equals sign per line.\nStep 2: Balance both sides by performing the exact same operation on the left and right.\nStep 3: Substitute your final answer back into the original line to verify 100% accuracy.',
  },
  {
    id: 'mat-stammering-speech',
    title: 'Zero-Rush Class Participation & Type-to-Speak Notes',
    subject: 'Communication',
    readTime: '3 min read',
    uploadedBy: 'Prof. Arjun Deshmukh',
    targetProfiles: ['stammering'],
    createdAt: '2026-11-12',
    content:
      'Designed for Secret Code Linguist learners — express every great idea at your own pace.\n\nKey Strategies:\n1. Type-to-Speak Studio: Prepare your question or answer in text and let EduCare speak it clearly.\n2. Quick Phrase Buttons: Raise a hand or request extra pacing with a single click.\n3. Written Exams & AI Tutor: Take all the time you need with zero speech pressure.',
  },
  {
    id: 'mat-classic-java',
    title: 'Java & Mathematics Foundations',
    subject: 'Computer Science',
    readTime: '4 min read',
    uploadedBy: 'Prof. Arjun Deshmukh',
    targetProfiles: ['standard'],
    createdAt: '2026-11-10',
    content:
      'Core foundations covering object-oriented programming in Java and algebraic problem solving.\n\nKey Concepts:\n1. Classes and Objects: A class is a blueprint, and an object is an instance created from it.\n2. Algebra: Isolate variables step by step to model real-world quantities.\n3. Study Tip: Combine practice questions in the Exam section with AI Tutor explanations.',
  },
];

export const RECORDED_LESSONS: RecordedLesson[] = [
  {
    id: 'rec-1',
    title: 'Introduction to Object-Oriented Programming in Java',
    subject: 'Java',
    duration: '24 min',
    instructor: 'Prof. Meera Nair',
    captionsAvailable: true,
    transcript:
      'Welcome to lesson one. Today we examine classes and objects in Java. Think of a class as an architectural blueprint and an object as a finished house built from that blueprint. Every object holds attributes like color or size and actions called methods.',
  },
  {
    id: 'rec-2',
    title: 'Writing Clean Loops and Functions in Python',
    subject: 'Python',
    duration: '19 min',
    instructor: 'Prof. Meera Nair',
    captionsAvailable: true,
    transcript:
      'In Python, a for-loop lets us repeat an action over every item in a list. Combining loops with small, clearly named functions makes code easy to navigate with keyboard shortcuts or screen readers.',
  },
  {
    id: 'rec-3',
    title: 'Linear Equations & Visual Problem Solving',
    subject: 'Mathematics',
    duration: '22 min',
    instructor: 'Dr. Kavita Rao',
    captionsAvailable: true,
    transcript:
      'When solving a linear equation such as 2x + 4 = 12, keep both sides balanced. Subtract 4 from both sides to get 2x = 8, then divide both sides by 2 to find x = 4.',
  },
  {
    id: 'rec-4',
    title: 'Study Ergonomics & Voice-First Workflows',
    subject: 'Study Skills',
    duration: '15 min',
    instructor: 'Ananya Verma',
    captionsAvailable: true,
    transcript:
      'Students studying from home or during medical recovery can combine voice dictation, large-text mode, and short focused study intervals to learn comfortably without physical strain.',
  },
];

export const INITIAL_ASSIGNMENTS: Assignment[] = [
  {
    id: 'asg-1',
    title: 'Java Class & Object Reflection',
    subject: 'Computer Science',
    dueDate: '2026-11-24',
    details:
      'Describe one real-world object (for example, a wheelchair, book, or desk lamp) and list three properties and two methods it would have as a Java class.',
    createdBy: 'Prof. Meera Nair',
  },
  {
    id: 'asg-2',
    title: 'Algebra Balance Practice Set',
    subject: 'Mathematics',
    dueDate: '2026-11-26',
    details:
      'Solve five single-variable equations in the Materials Audio Reader or notebook and check each answer by substitution.',
    createdBy: 'Prof. Meera Nair',
  },
];

export const EXAM_QUESTIONS: ExamQuestion[] = [
  {
    id: 'q1',
    subject: 'Java',
    prompt: 'What is Java?',
    options: [
      { id: 'q1-a', label: 'Operating System', isCorrect: false },
      { id: 'q1-b', label: 'Programming Language', isCorrect: true },
      { id: 'q1-c', label: 'Web Browser', isCorrect: false },
    ],
    explanation:
      'Java is an object-oriented programming language used to build cross-platform software.',
  },
  {
    id: 'q2',
    subject: 'Python',
    prompt: 'Which keyword is used to define a reusable function in Python?',
    options: [
      { id: 'q2-a', label: 'def', isCorrect: true },
      { id: 'q2-b', label: 'class', isCorrect: false },
      { id: 'q2-c', label: 'import', isCorrect: false },
    ],
    explanation:
      'The def keyword starts a function definition in Python, followed by the function name and parentheses.',
  },
  {
    id: 'q3',
    subject: 'Mathematics',
    prompt: 'If 2x + 4 = 12, what is the value of x?',
    options: [
      { id: 'q3-a', label: '2', isCorrect: false },
      { id: 'q3-b', label: '4', isCorrect: true },
      { id: 'q3-c', label: '8', isCorrect: false },
    ],
    explanation: 'Subtracting 4 gives 2x = 8, and dividing both sides by 2 gives x = 4.',
  },
  {
    id: 'q4',
    subject: 'Accessibility',
    prompt: 'Which keyboard key moves focus forward between interactive buttons and controls?',
    options: [
      { id: 'q4-a', label: 'Tab', isCorrect: true },
      { id: 'q4-b', label: 'Escape', isCorrect: false },
      { id: 'q4-c', label: 'Caps Lock', isCorrect: false },
    ],
    explanation:
      'Pressing Tab moves keyboard focus to the next interactive control, while Enter or Space activates it.',
  },
];

export const SIGN_LESSONS: SignLesson[] = [
  {
    id: 'sign-hello',
    word: 'Hello',
    category: 'Greeting',
    summary: 'Learn the sign for greeting someone warmly.',
    steps: [
      'Raise your open dominant hand near your forehead with fingers together.',
      'Move your hand outward and slightly away from your temple in a smooth salute.',
      'Maintain eye contact and a friendly expression.',
    ],
    gestureType: 'hello',
  },
  {
    id: 'sign-thankyou',
    word: 'Thank You',
    category: 'Courtesy',
    summary: 'Learn the sign used to express gratitude.',
    steps: [
      'Touch the fingertips of your flat hand gently to your chin.',
      'Move your hand forward and slightly downward toward the listener.',
      'Keep your palm facing upward as your hand extends.',
    ],
    gestureType: 'thankyou',
  },
  {
    id: 'sign-help',
    word: 'Help',
    category: 'Support',
    summary: 'Learn the sign used to request or offer assistance.',
    steps: [
      'Make a thumbs-up fist with one hand and place it on your open opposite palm.',
      'Lift both hands upward together toward chest or shoulder height.',
      'Reverse direction forward when offering help to someone else.',
    ],
    gestureType: 'help',
  },
  {
    id: 'sign-comm',
    word: 'Communication',
    category: 'Classroom',
    summary: 'Explore sign language lessons for classroom dialogue.',
    steps: [
      'Form C-shapes with both hands near your mouth.',
      'Move your hands alternately forward and back toward the listener.',
      'Indicates back-and-forth sharing of ideas.',
    ],
    gestureType: 'communication',
  },
  {
    id: 'sign-yes',
    word: 'Yes / Understand',
    category: 'Response',
    summary: 'Confirm understanding during live online classes.',
    steps: [
      'Close your dominant hand into a gentle fist.',
      'Nod your fist up and down from the wrist, mirroring a head nod.',
    ],
    gestureType: 'yes',
  },
  {
    id: 'sign-question',
    word: 'Question',
    category: 'Classroom',
    summary: 'Signal to your teacher that you have a question.',
    steps: [
      'Extend your index finger upright at shoulder height.',
      'Trace a small question-mark curve downward in the air ending with a tap.',
    ],
    gestureType: 'question',
  },
];
