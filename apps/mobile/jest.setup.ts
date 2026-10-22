import mockSafeAreaContext from 'react-native-safe-area-context/jest/mock';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-safe-area-context', () => mockSafeAreaContext);
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
