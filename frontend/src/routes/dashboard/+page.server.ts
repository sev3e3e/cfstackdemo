import type { PageServerLoad } from './$types';
import traceData from '../../trace.json';
import logData from '../../log.json';

export const load: PageServerLoad = async () => {
	return {
		traceData,
		logData
	};
};