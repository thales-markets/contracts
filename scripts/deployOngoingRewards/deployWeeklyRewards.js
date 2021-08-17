// - pause OngoingAidrop.sol (have to know where it was deployed)
// - calculate rewards per address for this period (assumption 130k THALES per week)
// - check last period merkle distribution and iterate all addresses
// -- if an address has claimed: continue
// -- if not: add that amount to the new period
// - create new merkle tree and set root
// - continue contract
// - deploy new merkle tree
// - EscrowContract update week
