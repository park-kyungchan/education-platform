import {fromJsonSchema} from '@modelcontextprotocol/server';
import {z} from 'zod';

/** SDK-supported adapter: advertise the original input shape and retain its exact parser/defaults.
 * Only the schema-error message is replaced, before the SDK serializes its automatic error result.
 */
export function boundedTeacherSchema<S extends z.ZodType>(schema:S){
  // Installed SDK and Zod disagree on the TS declaration of optional $vocabulary.
  // The generated JSON bytes are passed unchanged; the original parser owns runtime validation.
  const advertised=z.toJSONSchema(schema,{io:'input'}) as unknown as Parameters<typeof fromJsonSchema>[0];
  return fromJsonSchema<z.output<S>>(advertised,{
    getValidator<T>(){
      return (input:unknown)=>{
        try{
          const checked=schema.safeParse(input);
          if(checked.success)return {valid:true as const,data:checked.data as T,errorMessage:undefined};
        }catch{/* Never forward untrusted field names or parser details into the automatic SDK error. */}
        return {valid:false as const,data:undefined,errorMessage:'teacher_request_invalid'};
      };
    },
  });
}
