import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  getCollectionAuthorityRecordPDA,
  getCollectionPDA,
  getMasterEdition,
  getMetadata,
} from '../helpers/accounts';
import { TOKEN_METADATA_PROGRAM_ID } from '../helpers/constants';
import * as anchor from '@project-serum/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  MintLayout,
  Token,
} from '@solana/spl-token';
import { sendTransactionWithRetryWithKeypair } from '../helpers/transactions';
import {
  CreateMasterEditionV3,
  CreateMetadataV2,
  Creator,
  DataV2,
} from '@metaplex-foundation/mpl-token-metadata';
import log from 'loglevel';
import { Program } from '@project-serum/anchor';

export async function setCollection(
  walletKeypair: anchor.web3.Keypair,
  anchorProgram: Program,
  candyMachineAddress: PublicKey,
  // collectionMint?: PublicKey,
): Promise<string> {
  const mint = anchor.web3.Keypair.generate();
  // if (!collectionMint) {

  // } else {

  // }

  const wallet = new anchor.Wallet(walletKeypair);

  const userTokenAccountAddress = await Token.getAssociatedTokenAddress(
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    mint.publicKey,
    wallet.publicKey,
  );

  const candyMachine: any = await anchorProgram.account.candyMachine.fetch(
    candyMachineAddress,
  );

  const signers = [mint, walletKeypair];
  log.info('here');
  let instructions = [
    anchor.web3.SystemProgram.createAccount({
      fromPubkey: wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: MintLayout.span,
      lamports:
        await anchorProgram.provider.connection.getMinimumBalanceForRentExemption(
          MintLayout.span,
        ),
      programId: TOKEN_PROGRAM_ID,
    }),
    Token.createInitMintInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      0,
      wallet.publicKey,
      wallet.publicKey,
    ),
    Token.createAssociatedTokenAccountInstruction(
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccountAddress,
      wallet.publicKey,
      wallet.publicKey,
    ),
    Token.createMintToInstruction(
      TOKEN_PROGRAM_ID,
      mint.publicKey,
      userTokenAccountAddress,
      wallet.publicKey,
      [],
      1,
    ),
  ];

  const metadataAddress = await getMetadata(mint.publicKey);
  const masterEdition = await getMasterEdition(mint.publicKey);
  const [collectionPDA] = await getCollectionPDA(candyMachineAddress);
  const [collectionAuthorityRecord] = await getCollectionAuthorityRecordPDA(
    mint.publicKey,
    collectionPDA,
  );

  const data = new DataV2({
    symbol: candyMachine.data.symbol ?? '',
    name: 'Collection NFT',
    uri: '',
    sellerFeeBasisPoints: candyMachine.data.seller_fee_basis_points,
    creators: [
      new Creator({
        address: wallet.publicKey.toBase58(),
        verified: true,
        share: 100,
      }),
    ],
    collection: null,
    uses: null,
  });

  instructions = instructions.concat(
    new CreateMetadataV2(
      { feePayer: wallet.publicKey },
      {
        metadata: metadataAddress,
        metadataData: data,
        updateAuthority: wallet.publicKey,
        mint: mint.publicKey,
        mintAuthority: wallet.publicKey,
      },
    ).instructions,
  );

  instructions = instructions.concat(
    new CreateMasterEditionV3(
      {
        feePayer: wallet.publicKey,
      },
      {
        edition: masterEdition,
        metadata: metadataAddress,
        mint: mint.publicKey,
        mintAuthority: wallet.publicKey,
        updateAuthority: wallet.publicKey,
        maxSupply: new anchor.BN(0),
      },
    ).instructions,
  );

  await sendTransactionWithRetryWithKeypair(
    anchorProgram.provider.connection,
    walletKeypair,
    instructions,
    signers,
  );

  // const finished = await anchorProgram.rpc.setCollection(collectionData, {
  //     accounts: {
  //         candyMachine: candyMachineAddress,
  //         authority: wallet.publicKey,
  //         collectionPda: collectionPDA,
  //         payer: wallet.publicKey,
  //         systemProgram: SystemProgram.programId,
  //         rent: anchor.web3.SYSVAR_RENT_PUBKEY,
  //         metadata: metadataAddress,
  //         mint: mint.publicKey,
  //         edition: masterEdition,
  //         collectionAuthorityRecord: collectionAuthorityRecord,
  //         tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
  //     },
  //     // signers: [payerWallet, candyAccount],
  //     remainingAccounts: undefined,
  // });

  instructions = [
    await anchorProgram.instruction.setCollection(1, {
      accounts: {
        candyMachine: candyMachineAddress,
        authority: wallet.publicKey,
        collectionPda: collectionPDA,
        payer: wallet.publicKey,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        metadata: metadataAddress,
        mint: mint.publicKey,
        edition: masterEdition,
        collectionAuthorityRecord: collectionAuthorityRecord,
        tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
      },
    }),
  ];

  const finished = (
    await sendTransactionWithRetryWithKeypair(
      anchorProgram.provider.connection,
      walletKeypair,
      instructions,
      signers,
    )
  ).txid;
  return finished;
}
