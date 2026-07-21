declare module '@noble/post-quantum/ml-kem.js' {
  export interface MlKem {
    keygen: (seed?: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
    encapsulate: (publicKey: Uint8Array) => { cipherText: Uint8Array; sharedSecret: Uint8Array };
    decapsulate: (cipherText: Uint8Array, secretKey: Uint8Array) => Uint8Array;
  }
  export const ml_kem512: MlKem;
  export const ml_kem768: MlKem;
  export const ml_kem1024: MlKem;
}
