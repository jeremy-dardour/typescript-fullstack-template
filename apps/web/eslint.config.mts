import { boundariesFeatures, web } from '@workspace/eslint-config';

export default [...web(import.meta.dirname), ...boundariesFeatures];
