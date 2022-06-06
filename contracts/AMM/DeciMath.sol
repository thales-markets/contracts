// SPDX-License-Identifier: MIT

pragma solidity ^0.5.16;

contract DeciMath {
    // Abbreviation: DP stands for 'Decimal Places'

    uint constant TEN38 = 10**38;
    uint constant TEN30 = 10**30;
    uint constant TEN20 = 10**20;
    uint constant TEN19 = 10**19;
    uint constant TEN18 = 10**18;
    uint constant TEN17 = 10**17;
    uint constant TEN12 = 10**12;
    uint constant TEN11 = 10**11;
    uint constant TEN10 = 10**10;
    uint constant TEN9 = 10**9;
    uint constant TEN8 = 10**8;
    uint constant TEN7 = 10**7;

    // ln(2) - used in ln(x). 30 DP.
    uint constant LN2 = 693147180559945309417232121458;

    // 1 / ln(2) - used in exp(x). 30 DP.
    uint constant ONE_OVER_LN2 = 1442695040888963407359924681002;

    /***** LOOKUP TABLES *****/

    // Lookup table arrays (LUTs) for log_2(x)
    uint[100] public table_log_2;
    uint[100] public table2_log_2;

    // Lookup table for pow2(). Table contains 39 arrays, each array contains 10 uint slots.
    uint[10][39] public table_pow2;

    // LUT flags
    bool LUT1_isSet = false;
    bool LUT2_isSet = false;
    bool LUT3_1_isSet = false;
    bool LUT3_2_isSet = false;
    bool LUT3_3_isSet = false;
    bool LUT3_4_isSet = false;

    /******  BASIC MATH OPERATORS ******/

    // Integer math operators. Identical to Zeppelin's SafeMath
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) {
            return 0;
        }
        uint256 c = a * b;
        require(c / a == b, "uint overflow from multiplication");
        return c;
    }

    function div(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b > 0, "division by zero");
        uint256 c = a / b;
        return c;
    }

    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "uint underflow from subtraction");
        uint256 c = a - b;
        return c;
    }

    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "uint overflow from multiplication");
        return c;
    }

    // Basic decimal math operators. Inputs and outputs are uint representations of fixed-point decimals.

    // 18 Decimal places
    function decMul18(uint x, uint y) public pure returns (uint decProd) {
        uint prod_xy = mul(x, y);
        decProd = add(prod_xy, TEN18 / 2) / TEN18;
    }

    function decDiv18(uint x, uint y) public pure returns (uint decQuotient) {
        uint prod_xTEN18 = mul(x, TEN18);
        decQuotient = add(prod_xTEN18, y / 2) / y;
    }

    // 30 Decimal places
    function decMul30(uint x, uint y) public pure returns (uint decProd) {
        uint prod_xy = mul(x, y);
        decProd = add(prod_xy, TEN30 / 2) / TEN30;
    }

    // 38 Decimal places
    function decMul38(uint x, uint y) public pure returns (uint decProd) {
        uint prod_xy = mul(x, y);
        decProd = add(prod_xy, TEN38 / 2) / TEN38;
    }

    /****** HELPER FUNCTIONS ******/

    function convert38To18DP(uint x) public pure returns (uint y) {
        uint digit = (x % TEN20) / TEN19; // grab 20th digit from-right
        return chopAndRound(x, digit, 20);
    }

    function convert38To30DP(uint x) public pure returns (uint y) {
        uint digit = (x % TEN8) / TEN7; // grab 8th digit from-right
        return chopAndRound(x, digit, 8);
    }

    function convert30To20DP(uint x) public pure returns (uint y) {
        uint digit = (x % TEN10) / TEN9; // grab 10th digit from-right
        return chopAndRound(x, digit, 10);
    }

    function convert30To18DP(uint x) public pure returns (uint y) {
        uint digit = (x % TEN12) / TEN11; // grab 12th digit from-right
        return chopAndRound(x, digit, 12);
    }

    // Chop the last digits, and round the resulting number
    function chopAndRound(
        uint num,
        uint digit,
        uint positionOfChop
    ) public pure returns (uint chopped) {
        if (digit < 5) {
            chopped = div(num, 10**positionOfChop); // round down
        } else if (digit >= 5) {
            chopped = div(num, 10**positionOfChop) + 1; // round up
        }
        return chopped;
    }

    // return the floor of a fixed-point 20DP number
    function floor(uint x) public pure returns (uint num) {
        num = x - (x % TEN20);
        return num;
    }

    function countDigits(uint num) public pure returns (uint) {
        uint digits = 0;

        while (num != 0) {
            num /= 10; // When num < 10, yields 0 due to EVM floor division
            digits++;
        }
        return digits;
    }

    /****** MATH FUNCTIONS ******/

    // b^x for integer exponent. Use highly performant 'exponentiation-by-squaring' algorithm. O(log(n)) operations.

    // b^x - integer base, integer exponent
    function powBySquare(uint x, uint n) public pure returns (uint) {
        if (n == 0) return 1;

        uint y = 1;

        while (n > 1)
            if (n % 2 == 0) {
                x = mul(x, x);
                n = n / 2;
            } else if (n % 2 != 0) {
                y = mul(x, y);
                x = mul(x, x);
                n = (n - 1) / 2;
            }
        return mul(x, y);
    }

    // b^x - fixed-point 18 DP base, integer exponent
    function powBySquare18(uint base, uint n) public pure returns (uint) {
        if (n == 0) return TEN18;

        uint y = TEN18;

        while (n > 1) {
            if (n % 2 == 0) {
                base = decMul18(base, base);
                n = n / 2;
            } else if (n % 2 != 0) {
                y = decMul18(base, y);
                base = decMul18(base, base);
                n = (n - 1) / 2;
            }
        }
        return decMul18(base, y);
    }

    // b^x - fixed-point 38 DP base, integer exponent n
    function powBySquare38(uint base, uint n) public pure returns (uint) {
        if (n == 0) return TEN38;

        uint y = TEN38;

        while (n > 1) {
            if (n % 2 == 0) {
                base = decMul38(base, base);
                n = n / 2;
            } else if (n % 2 != 0) {
                y = decMul38(base, y);
                base = decMul38(base, base);
                n = (n - 1) / 2;
            }
        }
        return decMul38(base, y);
    }

    /* exp(x) function. Input 18 DP, output 18 DP.  Uses identities:

    A) e^x = 2^(x / ln(2))

    and

    B) 2^y = (2^r) * 2^(y - r); where r = floor(y) - 1, and (y - r) is in range [1,2[

    */
    function exp(uint x) public view returns (uint num) {
        uint intExponent; // 20 DP
        uint decExponent; // 20 DP
        uint coefficient; // 38 DP

        x = mul(x, TEN12); // make x 30DP
        x = decMul30(ONE_OVER_LN2, x);
        x = convert30To20DP(x);

        // if x < 1, do: (2^-1) * 2^(1 + x)
        if (x < TEN20 && x >= 0) {
            decExponent = add(TEN20, x);
            coefficient = TEN38 / 2;
            num = decMul38(coefficient, pow2(decExponent));
        }
        // Use identity B)
        else {
            intExponent = floor(x) - TEN20;
            decExponent = x - intExponent; // decimal exponent in range [1,2[
            coefficient = powBySquare(2, div(intExponent, TEN20));
            num = mul(coefficient, pow2(decExponent)); //  use normal mul to avoid overflow, as coeff. is an int
        }

        return convert38To18DP(num);
    }

    // Base-2 logarithm function, for x in range [1,2[. For use in ln(x). Input 18 DP, output 30 DP.
    function log_2(uint x, uint accuracy) public view _onlyLUT1andLUT2AreSet returns (uint) {
        require(x >= TEN18 && x < 2 * TEN18, "input x must be within range [1,2[");
        uint prod = mul(x, TEN20); // make x 38 DP
        uint newProd = TEN38;
        uint output = 0;

        for (uint i = 1; i <= accuracy; i++) {
            newProd = decMul38(table_log_2[i], prod);

            if (newProd >= TEN38) {
                prod = newProd;
                output += table2_log_2[i];
            }
        }
        return convert38To30DP(output);
    }

    // pow2(x) function, for use in exp(x). Uses 2D-array LUT. Valid for x in range [1,2[. Input 20DP, output 38DP
    function pow2(uint x) public view _onlyLUT3isSet returns (uint) {
        require(x >= TEN20 && x < 2 * TEN20, "input x must be within range [1,2[");
        uint x_38dp = x * TEN18;
        uint prod = 2 * TEN38;
        uint fractPart = x_38dp % TEN38;
        uint digitsLength = countDigits(fractPart);

        // loop backwards through mantissa digits - multiply each by the Lookup-table value
        for (uint i = 0; i < digitsLength; i++) {
            uint digit = (fractPart % (10**(i + 1))) / (10**i); // grab the i'th digit from right

            if (digit == 0) continue; // Save gas - skip the step if digit = 0 and there would be no resultant change to prod

            // computer i'th term, and new product
            uint term = table_pow2[37 - i][digit];
            prod = decMul38(prod, term);
        }
        return prod;
    }

    /* Natural log function ln(x). Input 18 DP, output 18 DP. Uses identities:

    A) ln(x) = log_2(x) * ln(2)

    and

    B) log_2(x) = log_2(2^q * y)           y in range [1,2[
                = q + log_2(y)

    The algorithm finds q and y by repeated division by powers-of-two.
    */
    function ln(uint x, uint accuracy) public view returns (uint) {
        require(x >= TEN18, "input must be >= 1");
        uint count = 0; // track

        /* Calculate q. Use branches to divide by powers-of-two, until output is in range [1,2[. Branch approach is more performant
        than simple successive division by 2. As max input of ln(x) is ~= 2^132, starting division at 2^30 yields sufficiently few operations for large x. */
        while (x >= 2 * TEN18) {
            if (x >= 1073741824 * TEN18) {
                // start at 2^30
                x = decDiv18(x, 1073741824 * TEN18);
                count += 30;
            } else if (x >= 1048576 * TEN18) {
                x = decDiv18(x, 1048576 * TEN18);
                count += 20;
            } else if (x >= 32768 * TEN18) {
                x = decDiv18(x, 32768 * TEN18);
                count += 15;
            } else if (x >= 1024 * TEN18) {
                x = decDiv18(x, 1024 * TEN18);
                count += 10;
            } else if (x >= 512 * TEN18) {
                x = decDiv18(x, 512 * TEN18);
                count += 9;
            } else if (x >= 256 * TEN18) {
                x = decDiv18(x, 256 * TEN18);
                count += 8;
            } else if (x >= 128 * TEN18) {
                x = decDiv18(x, 128 * TEN18);
                count += 7;
            } else if (x >= 64 * TEN18) {
                x = decDiv18(x, 64 * TEN18);
                count += 6;
            } else if (x >= 32 * TEN18) {
                x = decDiv18(x, 32 * TEN18);
                count += 5;
            } else if (x >= 16 * TEN18) {
                x = decDiv18(x, 16 * TEN18);
                count += 4;
            } else if (x >= 8 * TEN18) {
                x = decDiv18(x, 8 * TEN18);
                count += 3;
            } else if (x >= 4 * TEN18) {
                x = decDiv18(x, 4 * TEN18);
                count += 2;
            } else if (x >= 2 * TEN18) {
                x = decDiv18(x, 2 * TEN18);
                count += 1;
            }
        }

        uint q = count * TEN30;
        uint output = decMul30(LN2, add(q, log_2(x, accuracy)));

        return convert30To18DP(output);
    }

    /* pow(b, x) function for 18 DP base and exponent. Output 18 DP.

    Uses identity:  b^x = exp (x * ln(b)).

    For b < 1, rewrite b^x as:
    b^x = exp( x * (-ln(1/b)) ) = 1/exp(x * ln(1/b)).

     Thus, we avoid passing argument y < 1 to ln(y), and z < 0 to exp(z).   */
    function pow(uint base, uint x) public view returns (uint power) {
        if (base >= TEN18) {
            return exp(decMul18(x, ln(base, 70)));
        }

        if (base < TEN18) {
            uint exponent = decMul18(x, ln(decDiv18(TEN18, base), 70));
            return decDiv18(TEN18, exp(exponent));
        }
    }

    // Taylor series implementation of exp(x) - lower accuracy and higher gas cost than exp(x). 18 DP input and output.
    function exp_taylor(uint x) public pure returns (uint) {
        uint tolerance = 1;
        uint term = TEN18;
        uint sum = TEN18;
        uint i = 0;

        while (term > tolerance) {
            i += TEN18;
            term = decDiv18(decMul18(term, x), i);
            sum += term;
        }
        return sum;
    }

    /* Lookup Tables (LUTs). 38 DP fixed-point numbers. */

    // LUT1 for log_2(x). The i'th term is 1/(2^(1/2^i))
    function setLUT1() public {
        table_log_2[0] = 0;
        table_log_2[1] = 70710678118654752440084436210484903928;
        table_log_2[2] = 84089641525371454303112547623321489504;
        table_log_2[3] = 91700404320467123174354159479414442804;
        table_log_2[4] = 95760328069857364693630563514791544393;
        table_log_2[5] = 97857206208770013450916112581343574560;
        table_log_2[6] = 98922801319397548412912495906558366777;
        table_log_2[7] = 99459942348363317565247768622216631446;
        table_log_2[8] = 99729605608547012625765991384792260112;
        table_log_2[9] = 99864711289097017358812131808592040806;
        table_log_2[10] = 99932332750265075236028365984373804116;
        table_log_2[11] = 99966160649624368394219686876281565561;
        table_log_2[12] = 99983078893192906311748078019767389868;
        table_log_2[13] = 99991539088661349753372497156418872723;
        table_log_2[14] = 99995769454843113254396753730099797524;
        table_log_2[15] = 99997884705049192982650067113039327478;
        table_log_2[16] = 99998942346931446424221059225315431670;
        table_log_2[17] = 99999471172067428300770241277030532519;
        table_log_2[18] = 99999735585684139498225234636504270993;
        table_log_2[19] = 99999867792754675970531776759801063698;
        table_log_2[20] = 99999933896355489526178052900624509795;
        table_log_2[21] = 99999966948172282646511738368820575117;
        table_log_2[22] = 99999983474084775793885880947314828005;
        table_log_2[23] = 99999991737042046514572235133214264694;
        table_log_2[24] = 99999995868520937911689915196095249000;
        table_log_2[25] = 99999997934260447619445466250978583193;
        table_log_2[26] = 99999998967130218475622805194415901619;
        table_log_2[27] = 99999999483565107904286413727651274869;
        table_log_2[28] = 99999999741782553618761958785587923503;
        table_log_2[29] = 99999999870891276726035667265628464908;
        table_log_2[30] = 99999999935445638342181505587572099682;
        table_log_2[31] = 99999999967722819165881670780794171827;
        table_log_2[32] = 99999999983861409581638564886938948308;
        table_log_2[33] = 99999999991930704790493714817578668739;
        table_log_2[34] = 99999999995965352395165465502313349139;
        table_log_2[35] = 99999999997982676197562384774537267778;
        table_log_2[36] = 99999999998991338098776105393113730880;
        table_log_2[37] = 99999999999495669049386780948018133274;
        table_log_2[38] = 99999999999747834524693072536874382794;
        table_log_2[39] = 99999999999873917262346456784153520336;
        table_log_2[40] = 99999999999936958631173208521005842390;
        table_log_2[41] = 99999999999968479315586599292735191749;
        table_log_2[42] = 99999999999984239657793298404425663513;
        table_log_2[43] = 99999999999992119828896648891727348666;
        table_log_2[44] = 99999999999996059914448324368242303560;
        table_log_2[45] = 99999999999998029957224162164715809087;
        table_log_2[46] = 99999999999999014978612081077506568870;
        table_log_2[47] = 99999999999999507489306040537540450517;
        table_log_2[48] = 99999999999999753744653020268467016779;
        table_log_2[49] = 99999999999999876872326510134157706270;
        table_log_2[50] = 99999999999999938436163255067059902605;
        table_log_2[51] = 99999999999999969218081627533525213670;
        table_log_2[52] = 99999999999999984609040813766761422427;
        table_log_2[53] = 99999999999999992304520406883380415111;
        table_log_2[54] = 99999999999999996152260203441690133530;
        table_log_2[55] = 99999999999999998076130101720845048259;
        table_log_2[56] = 99999999999999999038065050860422519503;
        table_log_2[57] = 99999999999999999519032525430211258595;
        table_log_2[58] = 99999999999999999759516262715105629008;
        table_log_2[59] = 99999999999999999879758131357552814432;
        table_log_2[60] = 99999999999999999939879065678776407198;
        table_log_2[61] = 99999999999999999969939532839388203594;
        table_log_2[62] = 99999999999999999984969766419694101796;
        table_log_2[63] = 99999999999999999992484883209847050898;
        table_log_2[64] = 99999999999999999996242441604923525449;
        table_log_2[65] = 99999999999999999998121220802461762724;
        table_log_2[66] = 99999999999999999999060610401230881362;
        table_log_2[67] = 99999999999999999999530305200615440681;
        table_log_2[68] = 99999999999999999999765152600307720341;
        table_log_2[69] = 99999999999999999999882576300153860170;
        table_log_2[70] = 99999999999999999999941288150076930085;
        table_log_2[71] = 99999999999999999999970644075038465043;
        table_log_2[72] = 99999999999999999999985322037519232521;
        table_log_2[73] = 99999999999999999999992661018759616261;
        table_log_2[74] = 99999999999999999999996330509379808130;
        table_log_2[75] = 99999999999999999999998165254689904065;
        table_log_2[76] = 99999999999999999999999082627344952033;
        table_log_2[77] = 99999999999999999999999541313672476016;
        table_log_2[78] = 99999999999999999999999770656836238008;
        table_log_2[79] = 99999999999999999999999885328418119004;
        table_log_2[80] = 99999999999999999999999942664209059502;
        table_log_2[81] = 99999999999999999999999971332104529751;
        table_log_2[82] = 99999999999999999999999985666052264876;
        table_log_2[83] = 99999999999999999999999992833026132438;
        table_log_2[84] = 99999999999999999999999996416513066219;
        table_log_2[85] = 99999999999999999999999998208256533109;
        table_log_2[86] = 99999999999999999999999999104128266555;
        table_log_2[87] = 99999999999999999999999999552064133277;
        table_log_2[88] = 99999999999999999999999999776032066639;
        table_log_2[89] = 99999999999999999999999999888016033319;
        table_log_2[90] = 99999999999999999999999999944008016660;
        table_log_2[91] = 99999999999999999999999999972004008330;
        table_log_2[92] = 99999999999999999999999999986002004165;
        table_log_2[93] = 99999999999999999999999999993001002082;
        table_log_2[94] = 99999999999999999999999999996500501041;
        table_log_2[95] = 99999999999999999999999999998250250521;
        table_log_2[96] = 99999999999999999999999999999125125260;
        table_log_2[97] = 99999999999999999999999999999562562630;
        table_log_2[98] = 99999999999999999999999999999781281315;
        table_log_2[99] = 99999999999999999999999999999890640658;

        LUT1_isSet = true;
    }

    // LUT2 for log_2(x). The i'th term is 1/(2^i)
    function setLUT2() public {
        table2_log_2[0] = 200000000000000000000000000000000000000;
        table2_log_2[1] = 50000000000000000000000000000000000000;
        table2_log_2[2] = 25000000000000000000000000000000000000;
        table2_log_2[3] = 12500000000000000000000000000000000000;
        table2_log_2[4] = 6250000000000000000000000000000000000;
        table2_log_2[5] = 3125000000000000000000000000000000000;
        table2_log_2[6] = 1562500000000000000000000000000000000;
        table2_log_2[7] = 781250000000000000000000000000000000;
        table2_log_2[8] = 390625000000000000000000000000000000;
        table2_log_2[9] = 195312500000000000000000000000000000;
        table2_log_2[10] = 97656250000000000000000000000000000;
        table2_log_2[11] = 48828125000000000000000000000000000;
        table2_log_2[12] = 24414062500000000000000000000000000;
        table2_log_2[13] = 12207031250000000000000000000000000;
        table2_log_2[14] = 6103515625000000000000000000000000;
        table2_log_2[15] = 3051757812500000000000000000000000;
        table2_log_2[16] = 1525878906250000000000000000000000;
        table2_log_2[17] = 762939453125000000000000000000000;
        table2_log_2[18] = 381469726562500000000000000000000;
        table2_log_2[19] = 190734863281250000000000000000000;
        table2_log_2[20] = 95367431640625000000000000000000;
        table2_log_2[21] = 47683715820312500000000000000000;
        table2_log_2[22] = 23841857910156250000000000000000;
        table2_log_2[23] = 11920928955078125000000000000000;
        table2_log_2[24] = 5960464477539062500000000000000;
        table2_log_2[25] = 2980232238769531250000000000000;
        table2_log_2[26] = 1490116119384765625000000000000;
        table2_log_2[27] = 745058059692382812500000000000;
        table2_log_2[28] = 372529029846191406250000000000;
        table2_log_2[29] = 186264514923095703125000000000;
        table2_log_2[30] = 93132257461547851562500000000;
        table2_log_2[31] = 46566128730773925781250000000;
        table2_log_2[32] = 23283064365386962890625000000;
        table2_log_2[33] = 11641532182693481445312500000;
        table2_log_2[34] = 5820766091346740722656250000;
        table2_log_2[35] = 2910383045673370361328125000;
        table2_log_2[36] = 1455191522836685180664062500;
        table2_log_2[37] = 727595761418342590332031250;
        table2_log_2[38] = 363797880709171295166015625;
        table2_log_2[39] = 181898940354585647583007812;
        table2_log_2[40] = 90949470177292823791503906;
        table2_log_2[41] = 45474735088646411895751953;
        table2_log_2[42] = 22737367544323205947875976;
        table2_log_2[43] = 11368683772161602973937988;
        table2_log_2[44] = 5684341886080801486968994;
        table2_log_2[45] = 2842170943040400743484497;
        table2_log_2[46] = 1421085471520200371742248;
        table2_log_2[47] = 710542735760100185871124;
        table2_log_2[48] = 355271367880050092935562;
        table2_log_2[49] = 177635683940025046467781;
        table2_log_2[50] = 88817841970012523233890;
        table2_log_2[51] = 44408920985006261616945;
        table2_log_2[52] = 22204460492503130808472;
        table2_log_2[53] = 11102230246251565404236;
        table2_log_2[54] = 5551115123125782702118;
        table2_log_2[55] = 2775557561562891351059;
        table2_log_2[56] = 1387778780781445675529;
        table2_log_2[57] = 693889390390722837764;
        table2_log_2[58] = 346944695195361418882;
        table2_log_2[59] = 173472347597680709441;
        table2_log_2[60] = 86736173798840354720;
        table2_log_2[61] = 43368086899420177360;
        table2_log_2[62] = 21684043449710088680;
        table2_log_2[63] = 10842021724855044340;
        table2_log_2[64] = 5421010862427522170;
        table2_log_2[65] = 2710505431213761085;
        table2_log_2[66] = 1355252715606880542;
        table2_log_2[67] = 677626357803440271;
        table2_log_2[68] = 338813178901720135;
        table2_log_2[69] = 169406589450860067;
        table2_log_2[70] = 84703294725430033;
        table2_log_2[71] = 42351647362715016;
        table2_log_2[72] = 21175823681357508;
        table2_log_2[73] = 10587911840678754;
        table2_log_2[74] = 5293955920339377;
        table2_log_2[75] = 2646977960169688;
        table2_log_2[76] = 1323488980084844;
        table2_log_2[77] = 661744490042422;
        table2_log_2[78] = 330872245021211;
        table2_log_2[79] = 165436122510605;
        table2_log_2[80] = 82718061255302;
        table2_log_2[81] = 41359030627651;
        table2_log_2[82] = 20679515313825;
        table2_log_2[83] = 10339757656912;
        table2_log_2[84] = 5169878828456;
        table2_log_2[85] = 2584939414228;
        table2_log_2[86] = 1292469707114;
        table2_log_2[87] = 646234853557;
        table2_log_2[88] = 323117426778;
        table2_log_2[89] = 161558713389;
        table2_log_2[90] = 80779356694;
        table2_log_2[91] = 40389678347;
        table2_log_2[92] = 20194839173;
        table2_log_2[93] = 10097419586;
        table2_log_2[94] = 5048709793;
        table2_log_2[95] = 2524354896;
        table2_log_2[96] = 1262177448;
        table2_log_2[97] = 631088724;
        table2_log_2[98] = 315544362;
        table2_log_2[99] = 157772181;

        LUT2_isSet = true;
    }

    /* LUT for pow2() function. Table contains 39 arrays, each array contains 10 uint slots.

    table_pow2[i][d] = (2^(1 / 10^(i + 1))) ** d.
    d ranges from 0 to 9.

    LUT-setting is split into four separate setter functions to keep gas costs under block limit.
    */
    function setLUT3_1() public {
        table_pow2[0][0] = 100000000000000000000000000000000000000;
        table_pow2[0][1] = 107177346253629316421300632502334202291;
        table_pow2[0][2] = 114869835499703500679862694677792758944;
        table_pow2[0][3] = 123114441334491628449939306916774310988;
        table_pow2[0][4] = 131950791077289425937400197122964013303;
        table_pow2[0][5] = 141421356237309504880168872420969807857;
        table_pow2[0][6] = 151571656651039808234725980130644523868;
        table_pow2[0][7] = 162450479271247104521941876555056330257;
        table_pow2[0][8] = 174110112659224827827254003495949219796;
        table_pow2[0][9] = 186606598307361483196268653229988433405;
        table_pow2[1][0] = 100000000000000000000000000000000000000;
        table_pow2[1][1] = 100695555005671880883269821411323978545;
        table_pow2[1][2] = 101395947979002913869016599962823042584;
        table_pow2[1][3] = 102101212570719324976409517478306437354;
        table_pow2[1][4] = 102811382665606650934634495879263497655;
        table_pow2[1][5] = 103526492384137750434778819421124619773;
        table_pow2[1][6] = 104246576084112139095471141872690784007;
        table_pow2[1][7] = 104971668362306726904934732174028851665;
        table_pow2[1][8] = 105701804056138037449949421408611430989;
        table_pow2[1][9] = 106437018245335988793865835140404338206;
        table_pow2[2][0] = 100000000000000000000000000000000000000;
        table_pow2[2][1] = 100069338746258063253756863930385919571;
        table_pow2[2][2] = 100138725571133452908322477441877746756;
        table_pow2[2][3] = 100208160507963279436035132489114568295;
        table_pow2[2][4] = 100277643590107768843673305907248072983;
        table_pow2[2][5] = 100347174850950278700477431086959080340;
        table_pow2[2][6] = 100416754323897314177285298995922943429;
        table_pow2[2][7] = 100486382042378544096788794597976421668;
        table_pow2[2][8] = 100556058039846816994919680064517944020;
        table_pow2[2][9] = 100625782349778177193372141519657470417;
        table_pow2[3][0] = 100000000000000000000000000000000000000;
        table_pow2[3][1] = 100006931712037656919243991260264256542;
        table_pow2[3][2] = 100013863904561631568466376833067115945;
        table_pow2[3][3] = 100020796577605229875592540103010552992;
        table_pow2[3][4] = 100027729731201760077218879711834041246;
        table_pow2[3][5] = 100034663365384532718772839985089028270;
        table_pow2[3][6] = 100041597480186860654672952451661760537;
        table_pow2[3][7] = 100048532075642059048488888456913382370;
        table_pow2[3][8] = 100055467151783445373101522870206286485;
        table_pow2[3][9] = 100062402708644339410863008887585747065;
        table_pow2[4][0] = 100000000000000000000000000000000000000;
        table_pow2[4][1] = 100000693149582830565320908980056168150;
        table_pow2[4][2] = 100001386303970224572423685307245831542;
        table_pow2[4][3] = 100002079463162215324119782522433627138;
        table_pow2[4][4] = 100002772627158836123451492465145260129;
        table_pow2[4][5] = 100003465795960120273691946873622208121;
        table_pow2[4][6] = 100004158969566101078345118984887516084;
        table_pow2[4][7] = 100004852147976811841145825134822682163;
        table_pow2[4][8] = 100005545331192285866059726358255634403;
        table_pow2[4][9] = 100006238519212556457283329989059798485;
        table_pow2[5][0] = 100000000000000000000000000000000000000;
        table_pow2[5][1] = 100000069314742078650777263622740703038;
        table_pow2[5][2] = 100000138629532202636248826052225815048;
        table_pow2[5][3] = 100000207944370371989717187112633071811;
        table_pow2[5][4] = 100000277259256586744484869711682067979;
        table_pow2[5][5] = 100000346574190846933854419840650257373;
        table_pow2[5][6] = 100000415889173152591128406574388953292;
        table_pow2[5][7] = 100000485204203503749609422071339328833;
        table_pow2[5][8] = 100000554519281900442600081573548417222;
        table_pow2[5][9] = 100000623834408342703403023406685112154;
        table_pow2[6][0] = 100000000000000000000000000000000000000;
        table_pow2[6][1] = 100000006931472045825965603683996211583;
        table_pow2[6][2] = 100000013862944572104978428035962521332;
        table_pow2[6][3] = 100000020794417578837071775524560348874;
        table_pow2[6][4] = 100000027725891066022278948620759465140;
        table_pow2[6][5] = 100000034657365033660633249797837992529;
        table_pow2[6][6] = 100000041588839481752167981531382405066;
        table_pow2[6][7] = 100000048520314410296916446299287528561;
        table_pow2[6][8] = 100000055451789819294911946581756540768;
        table_pow2[6][9] = 100000062383265708746187784861300971552;
        table_pow2[7][0] = 100000000000000000000000000000000000000;
        table_pow2[7][1] = 100000000693147182962210384558650120894;
        table_pow2[7][2] = 100000001386294370728950941601779822006;
        table_pow2[7][3] = 100000002079441563300221704431854648481;
        table_pow2[7][4] = 100000002772588760676022706351340376300;
        table_pow2[7][5] = 100000003465735962856353980662703012279;
        table_pow2[7][6] = 100000004158883169841215560668408794069;
        table_pow2[7][7] = 100000004852030381630607479670924190156;
        table_pow2[7][8] = 100000005545177598224529770972715899860;
        table_pow2[7][9] = 100000006238324819622982467876250853339;
        table_pow2[8][0] = 100000000000000000000000000000000000000;
        table_pow2[8][1] = 100000000069314718080017181643183694247;
        table_pow2[8][2] = 100000000138629436208079664711489996172;
        table_pow2[8][3] = 100000000207944154384187449238221371011;
        table_pow2[8][4] = 100000000277258872608340535256680284018;
        table_pow2[8][5] = 100000000346573590880538922800169200474;
        table_pow2[8][6] = 100000000415888309200782611901990585682;
        table_pow2[8][7] = 100000000485203027569071602595446904968;
        table_pow2[8][8] = 100000000554517745985405894913840623680;
        table_pow2[8][9] = 100000000623832464449785488890474207190;
        table_pow2[9][0] = 100000000000000000000000000000000000000;
        table_pow2[9][1] = 100000000006931471805839679601136972338;
        table_pow2[9][2] = 100000000013862943612159812216225448565;
        table_pow2[9][3] = 100000000020794415418960397845298731148;
        table_pow2[9][4] = 100000000027725887226241436488390122551;
        table_pow2[9][5] = 100000000034657359034002928145532925240;
        table_pow2[9][6] = 100000000041588830842244872816760441679;
        table_pow2[9][7] = 100000000048520302650967270502105974334;
        table_pow2[9][8] = 100000000055451774460170121201602825670;
        table_pow2[9][9] = 100000000062383246269853424915284298153;
        table_pow2[10][0] = 100000000000000000000000000000000000000;
        table_pow2[10][1] = 100000000000693147180562347574486828679;
        table_pow2[10][2] = 100000000001386294361129499679112872675;
        table_pow2[10][3] = 100000000002079441541701456313878165290;
        table_pow2[10][4] = 100000000002772588722278217478782739826;
        table_pow2[10][5] = 100000000003465735902859783173826629587;
        table_pow2[10][6] = 100000000004158883083446153399009867874;
        table_pow2[10][7] = 100000000004852030264037328154332487990;
        table_pow2[10][8] = 100000000005545177444633307439794523238;
        table_pow2[10][9] = 100000000006238324625234091255396006920;

        LUT3_1_isSet = true;
    }

    function setLUT3_2() public {
        table_pow2[11][0] = 100000000000000000000000000000000000000;
        table_pow2[11][1] = 100000000000069314718056018553592419128;
        table_pow2[11][2] = 100000000000138629436112085152486230109;
        table_pow2[11][3] = 100000000000207944154168199796681432977;
        table_pow2[11][4] = 100000000000277258872224362486178027765;
        table_pow2[11][5] = 100000000000346573590280573220976014506;
        table_pow2[11][6] = 100000000000415888308336832001075393234;
        table_pow2[11][7] = 100000000000485203026393138826476163982;
        table_pow2[11][8] = 100000000000554517744449493697178326784;
        table_pow2[11][9] = 100000000000623832462505896613181881671;
        table_pow2[12][0] = 100000000000000000000000000000000000000;
        table_pow2[12][1] = 100000000000006931471805599693320679280;
        table_pow2[12][2] = 100000000000013862943611199867094372479;
        table_pow2[12][3] = 100000000000020794415416800521321079596;
        table_pow2[12][4] = 100000000000027725887222401656000800631;
        table_pow2[12][5] = 100000000000034657359028003271133535584;
        table_pow2[12][6] = 100000000000041588830833605366719284456;
        table_pow2[12][7] = 100000000000048520302639207942758047246;
        table_pow2[12][8] = 100000000000055451774444810999249823955;
        table_pow2[12][9] = 100000000000062383246250414536194614582;
        table_pow2[13][0] = 100000000000000000000000000000000000000;
        table_pow2[13][1] = 100000000000000693147180559947711682302;
        table_pow2[13][2] = 100000000000001386294361119900227894743;
        table_pow2[13][3] = 100000000000002079441541679857548637323;
        table_pow2[13][4] = 100000000000002772588722239819673910042;
        table_pow2[13][5] = 100000000000003465735902799786603712900;
        table_pow2[13][6] = 100000000000004158883083359758338045898;
        table_pow2[13][7] = 100000000000004852030263919734876909035;
        table_pow2[13][8] = 100000000000005545177444479716220302311;
        table_pow2[13][9] = 100000000000006238324625039702368225726;
        table_pow2[14][0] = 100000000000000000000000000000000000000;
        table_pow2[14][1] = 100000000000000069314718055994554964374;
        table_pow2[14][2] = 100000000000000138629436111989157974049;
        table_pow2[14][3] = 100000000000000207944154167983809029026;
        table_pow2[14][4] = 100000000000000277258872223978508129304;
        table_pow2[14][5] = 100000000000000346573590279973255274883;
        table_pow2[14][6] = 100000000000000415888308335968050465764;
        table_pow2[14][7] = 100000000000000485203026391962893701947;
        table_pow2[14][8] = 100000000000000554517744447957784983430;
        table_pow2[14][9] = 100000000000000623832462503952724310215;
        table_pow2[15][0] = 100000000000000000000000000000000000000;
        table_pow2[15][1] = 100000000000000006931471805599453334399;
        table_pow2[15][2] = 100000000000000013862943611198907149251;
        table_pow2[15][3] = 100000000000000020794415416798361444556;
        table_pow2[15][4] = 100000000000000027725887222397816220313;
        table_pow2[15][5] = 100000000000000034657359027997271476524;
        table_pow2[15][6] = 100000000000000041588830833596727213188;
        table_pow2[15][7] = 100000000000000048520302639196183430305;
        table_pow2[15][8] = 100000000000000055451774444795640127875;
        table_pow2[15][9] = 100000000000000062383246250395097305898;
        table_pow2[16][0] = 100000000000000000000000000000000000000;
        table_pow2[16][1] = 100000000000000000693147180559945311819;
        table_pow2[16][2] = 100000000000000001386294361119890628444;
        table_pow2[16][3] = 100000000000000002079441541679835949872;
        table_pow2[16][4] = 100000000000000002772588722239781276105;
        table_pow2[16][5] = 100000000000000003465735902799726607143;
        table_pow2[16][6] = 100000000000000004158883083359671942985;
        table_pow2[16][7] = 100000000000000004852030263919617283632;
        table_pow2[16][8] = 100000000000000005545177444479562629083;
        table_pow2[16][9] = 100000000000000006238324625039507979339;
        table_pow2[17][0] = 100000000000000000000000000000000000000;
        table_pow2[17][1] = 100000000000000000069314718055994530966;
        table_pow2[17][2] = 100000000000000000138629436111989061980;
        table_pow2[17][3] = 100000000000000000207944154167983593041;
        table_pow2[17][4] = 100000000000000000277258872223978124151;
        table_pow2[17][5] = 100000000000000000346573590279972655309;
        table_pow2[17][6] = 100000000000000000415888308335967186515;
        table_pow2[17][7] = 100000000000000000485203026391961717769;
        table_pow2[17][8] = 100000000000000000554517744447956249071;
        table_pow2[17][9] = 100000000000000000623832462503950780421;
        table_pow2[18][0] = 100000000000000000000000000000000000000;
        table_pow2[18][1] = 100000000000000000006931471805599453094;
        table_pow2[18][2] = 100000000000000000013862943611198906189;
        table_pow2[18][3] = 100000000000000000020794415416798359285;
        table_pow2[18][4] = 100000000000000000027725887222397812381;
        table_pow2[18][5] = 100000000000000000034657359027997265477;
        table_pow2[18][6] = 100000000000000000041588830833596718574;
        table_pow2[18][7] = 100000000000000000048520302639196171671;
        table_pow2[18][8] = 100000000000000000055451774444795624769;
        table_pow2[18][9] = 100000000000000000062383246250395077867;
        table_pow2[19][0] = 100000000000000000000000000000000000000;
        table_pow2[19][1] = 100000000000000000000693147180559945309;
        table_pow2[19][2] = 100000000000000000001386294361119890619;
        table_pow2[19][3] = 100000000000000000002079441541679835928;
        table_pow2[19][4] = 100000000000000000002772588722239781238;
        table_pow2[19][5] = 100000000000000000003465735902799726547;
        table_pow2[19][6] = 100000000000000000004158883083359671857;
        table_pow2[19][7] = 100000000000000000004852030263919617166;
        table_pow2[19][8] = 100000000000000000005545177444479562475;
        table_pow2[19][9] = 100000000000000000006238324625039507785;
        table_pow2[20][0] = 100000000000000000000000000000000000000;
        table_pow2[20][1] = 100000000000000000000069314718055994531;
        table_pow2[20][2] = 100000000000000000000138629436111989062;
        table_pow2[20][3] = 100000000000000000000207944154167983593;
        table_pow2[20][4] = 100000000000000000000277258872223978124;
        table_pow2[20][5] = 100000000000000000000346573590279972655;
        table_pow2[20][6] = 100000000000000000000415888308335967186;
        table_pow2[20][7] = 100000000000000000000485203026391961717;
        table_pow2[20][8] = 100000000000000000000554517744447956248;
        table_pow2[20][9] = 100000000000000000000623832462503950778;

        LUT3_2_isSet = true;
    }

    function setLUT3_3() public {
        table_pow2[21][0] = 100000000000000000000000000000000000000;
        table_pow2[21][1] = 100000000000000000000006931471805599453;
        table_pow2[21][2] = 100000000000000000000013862943611198906;
        table_pow2[21][3] = 100000000000000000000020794415416798359;
        table_pow2[21][4] = 100000000000000000000027725887222397812;
        table_pow2[21][5] = 100000000000000000000034657359027997265;
        table_pow2[21][6] = 100000000000000000000041588830833596719;
        table_pow2[21][7] = 100000000000000000000048520302639196172;
        table_pow2[21][8] = 100000000000000000000055451774444795625;
        table_pow2[21][9] = 100000000000000000000062383246250395078;
        table_pow2[22][0] = 100000000000000000000000000000000000000;
        table_pow2[22][1] = 100000000000000000000000693147180559945;
        table_pow2[22][2] = 100000000000000000000001386294361119891;
        table_pow2[22][3] = 100000000000000000000002079441541679836;
        table_pow2[22][4] = 100000000000000000000002772588722239781;
        table_pow2[22][5] = 100000000000000000000003465735902799727;
        table_pow2[22][6] = 100000000000000000000004158883083359672;
        table_pow2[22][7] = 100000000000000000000004852030263919617;
        table_pow2[22][8] = 100000000000000000000005545177444479562;
        table_pow2[22][9] = 100000000000000000000006238324625039508;
        table_pow2[23][0] = 100000000000000000000000000000000000000;
        table_pow2[23][1] = 100000000000000000000000069314718055995;
        table_pow2[23][2] = 100000000000000000000000138629436111989;
        table_pow2[23][3] = 100000000000000000000000207944154167984;
        table_pow2[23][4] = 100000000000000000000000277258872223978;
        table_pow2[23][5] = 100000000000000000000000346573590279973;
        table_pow2[23][6] = 100000000000000000000000415888308335967;
        table_pow2[23][7] = 100000000000000000000000485203026391962;
        table_pow2[23][8] = 100000000000000000000000554517744447956;
        table_pow2[23][9] = 100000000000000000000000623832462503951;
        table_pow2[24][0] = 100000000000000000000000000000000000000;
        table_pow2[24][1] = 100000000000000000000000006931471805599;
        table_pow2[24][2] = 100000000000000000000000013862943611199;
        table_pow2[24][3] = 100000000000000000000000020794415416798;
        table_pow2[24][4] = 100000000000000000000000027725887222398;
        table_pow2[24][5] = 100000000000000000000000034657359027997;
        table_pow2[24][6] = 100000000000000000000000041588830833597;
        table_pow2[24][7] = 100000000000000000000000048520302639196;
        table_pow2[24][8] = 100000000000000000000000055451774444796;
        table_pow2[24][9] = 100000000000000000000000062383246250395;
        table_pow2[25][0] = 100000000000000000000000000000000000000;
        table_pow2[25][1] = 100000000000000000000000000693147180560;
        table_pow2[25][2] = 100000000000000000000000001386294361120;
        table_pow2[25][3] = 100000000000000000000000002079441541680;
        table_pow2[25][4] = 100000000000000000000000002772588722240;
        table_pow2[25][5] = 100000000000000000000000003465735902800;
        table_pow2[25][6] = 100000000000000000000000004158883083360;
        table_pow2[25][7] = 100000000000000000000000004852030263920;
        table_pow2[25][8] = 100000000000000000000000005545177444480;
        table_pow2[25][9] = 100000000000000000000000006238324625040;
        table_pow2[26][0] = 100000000000000000000000000000000000000;
        table_pow2[26][1] = 100000000000000000000000000069314718056;
        table_pow2[26][2] = 100000000000000000000000000138629436112;
        table_pow2[26][3] = 100000000000000000000000000207944154168;
        table_pow2[26][4] = 100000000000000000000000000277258872224;
        table_pow2[26][5] = 100000000000000000000000000346573590280;
        table_pow2[26][6] = 100000000000000000000000000415888308336;
        table_pow2[26][7] = 100000000000000000000000000485203026392;
        table_pow2[26][8] = 100000000000000000000000000554517744448;
        table_pow2[26][9] = 100000000000000000000000000623832462504;
        table_pow2[27][0] = 100000000000000000000000000000000000000;
        table_pow2[27][1] = 100000000000000000000000000006931471806;
        table_pow2[27][2] = 100000000000000000000000000013862943611;
        table_pow2[27][3] = 100000000000000000000000000020794415417;
        table_pow2[27][4] = 100000000000000000000000000027725887222;
        table_pow2[27][5] = 100000000000000000000000000034657359028;
        table_pow2[27][6] = 100000000000000000000000000041588830834;
        table_pow2[27][7] = 100000000000000000000000000048520302639;
        table_pow2[27][8] = 100000000000000000000000000055451774445;
        table_pow2[27][9] = 100000000000000000000000000062383246250;
        table_pow2[28][0] = 100000000000000000000000000000000000000;
        table_pow2[28][1] = 100000000000000000000000000000693147181;
        table_pow2[28][2] = 100000000000000000000000000001386294361;
        table_pow2[28][3] = 100000000000000000000000000002079441542;
        table_pow2[28][4] = 100000000000000000000000000002772588722;
        table_pow2[28][5] = 100000000000000000000000000003465735903;
        table_pow2[28][6] = 100000000000000000000000000004158883083;
        table_pow2[28][7] = 100000000000000000000000000004852030264;
        table_pow2[28][8] = 100000000000000000000000000005545177444;
        table_pow2[28][9] = 100000000000000000000000000006238324625;
        table_pow2[29][0] = 100000000000000000000000000000000000000;
        table_pow2[29][1] = 100000000000000000000000000000069314718;
        table_pow2[29][2] = 100000000000000000000000000000138629436;
        table_pow2[29][3] = 100000000000000000000000000000207944154;
        table_pow2[29][4] = 100000000000000000000000000000277258872;
        table_pow2[29][5] = 100000000000000000000000000000346573590;
        table_pow2[29][6] = 100000000000000000000000000000415888308;
        table_pow2[29][7] = 100000000000000000000000000000485203026;
        table_pow2[29][8] = 100000000000000000000000000000554517744;
        table_pow2[29][9] = 100000000000000000000000000000623832463;
        table_pow2[30][0] = 100000000000000000000000000000000000000;
        table_pow2[30][1] = 100000000000000000000000000000006931472;
        table_pow2[30][2] = 100000000000000000000000000000013862944;
        table_pow2[30][3] = 100000000000000000000000000000020794415;
        table_pow2[30][4] = 100000000000000000000000000000027725887;
        table_pow2[30][5] = 100000000000000000000000000000034657359;
        table_pow2[30][6] = 100000000000000000000000000000041588831;
        table_pow2[30][7] = 100000000000000000000000000000048520303;
        table_pow2[30][8] = 100000000000000000000000000000055451774;
        table_pow2[30][9] = 100000000000000000000000000000062383246;

        LUT3_3_isSet = true;
    }

    function setLUT3_4() public {
        table_pow2[31][0] = 100000000000000000000000000000000000000;
        table_pow2[31][1] = 100000000000000000000000000000000693147;
        table_pow2[31][2] = 100000000000000000000000000000001386294;
        table_pow2[31][3] = 100000000000000000000000000000002079442;
        table_pow2[31][4] = 100000000000000000000000000000002772589;
        table_pow2[31][5] = 100000000000000000000000000000003465736;
        table_pow2[31][6] = 100000000000000000000000000000004158883;
        table_pow2[31][7] = 100000000000000000000000000000004852030;
        table_pow2[31][8] = 100000000000000000000000000000005545177;
        table_pow2[31][9] = 100000000000000000000000000000006238325;
        table_pow2[32][0] = 100000000000000000000000000000000000000;
        table_pow2[32][1] = 100000000000000000000000000000000069315;
        table_pow2[32][2] = 100000000000000000000000000000000138629;
        table_pow2[32][3] = 100000000000000000000000000000000207944;
        table_pow2[32][4] = 100000000000000000000000000000000277259;
        table_pow2[32][5] = 100000000000000000000000000000000346574;
        table_pow2[32][6] = 100000000000000000000000000000000415888;
        table_pow2[32][7] = 100000000000000000000000000000000485203;
        table_pow2[32][8] = 100000000000000000000000000000000554518;
        table_pow2[32][9] = 100000000000000000000000000000000623832;
        table_pow2[33][0] = 100000000000000000000000000000000000000;
        table_pow2[33][1] = 100000000000000000000000000000000006931;
        table_pow2[33][2] = 100000000000000000000000000000000013863;
        table_pow2[33][3] = 100000000000000000000000000000000020794;
        table_pow2[33][4] = 100000000000000000000000000000000027726;
        table_pow2[33][5] = 100000000000000000000000000000000034657;
        table_pow2[33][6] = 100000000000000000000000000000000041589;
        table_pow2[33][7] = 100000000000000000000000000000000048520;
        table_pow2[33][8] = 100000000000000000000000000000000055452;
        table_pow2[33][9] = 100000000000000000000000000000000062383;
        table_pow2[34][0] = 100000000000000000000000000000000000000;
        table_pow2[34][1] = 100000000000000000000000000000000000693;
        table_pow2[34][2] = 100000000000000000000000000000000001386;
        table_pow2[34][3] = 100000000000000000000000000000000002079;
        table_pow2[34][4] = 100000000000000000000000000000000002773;
        table_pow2[34][5] = 100000000000000000000000000000000003466;
        table_pow2[34][6] = 100000000000000000000000000000000004159;
        table_pow2[34][7] = 100000000000000000000000000000000004852;
        table_pow2[34][8] = 100000000000000000000000000000000005545;
        table_pow2[34][9] = 100000000000000000000000000000000006238;
        table_pow2[35][0] = 100000000000000000000000000000000000000;
        table_pow2[35][1] = 100000000000000000000000000000000000069;
        table_pow2[35][2] = 100000000000000000000000000000000000139;
        table_pow2[35][3] = 100000000000000000000000000000000000208;
        table_pow2[35][4] = 100000000000000000000000000000000000277;
        table_pow2[35][5] = 100000000000000000000000000000000000347;
        table_pow2[35][6] = 100000000000000000000000000000000000416;
        table_pow2[35][7] = 100000000000000000000000000000000000485;
        table_pow2[35][8] = 100000000000000000000000000000000000555;
        table_pow2[35][9] = 100000000000000000000000000000000000624;
        table_pow2[36][0] = 100000000000000000000000000000000000000;
        table_pow2[36][1] = 100000000000000000000000000000000000007;
        table_pow2[36][2] = 100000000000000000000000000000000000014;
        table_pow2[36][3] = 100000000000000000000000000000000000021;
        table_pow2[36][4] = 100000000000000000000000000000000000028;
        table_pow2[36][5] = 100000000000000000000000000000000000035;
        table_pow2[36][6] = 100000000000000000000000000000000000042;
        table_pow2[36][7] = 100000000000000000000000000000000000049;
        table_pow2[36][8] = 100000000000000000000000000000000000055;
        table_pow2[36][9] = 100000000000000000000000000000000000062;
        table_pow2[37][0] = 100000000000000000000000000000000000000;
        table_pow2[37][1] = 100000000000000000000000000000000000001;
        table_pow2[37][2] = 100000000000000000000000000000000000001;
        table_pow2[37][3] = 100000000000000000000000000000000000002;
        table_pow2[37][4] = 100000000000000000000000000000000000003;
        table_pow2[37][5] = 100000000000000000000000000000000000003;
        table_pow2[37][6] = 100000000000000000000000000000000000004;
        table_pow2[37][7] = 100000000000000000000000000000000000005;
        table_pow2[37][8] = 100000000000000000000000000000000000006;
        table_pow2[37][9] = 100000000000000000000000000000000000006;
        table_pow2[38][0] = 100000000000000000000000000000000000000;
        table_pow2[38][1] = 100000000000000000000000000000000000000;
        table_pow2[38][2] = 100000000000000000000000000000000000000;
        table_pow2[38][3] = 100000000000000000000000000000000000000;
        table_pow2[38][4] = 100000000000000000000000000000000000000;
        table_pow2[38][5] = 100000000000000000000000000000000000000;
        table_pow2[38][6] = 100000000000000000000000000000000000000;
        table_pow2[38][7] = 100000000000000000000000000000000000000;
        table_pow2[38][8] = 100000000000000000000000000000000000001;
        table_pow2[38][9] = 100000000000000000000000000000000000001;

        LUT3_4_isSet = true;
    }

    /***** MODIFIERS *****/

    modifier _onlyLUT1andLUT2AreSet() {
        require(LUT1_isSet == true && LUT2_isSet == true, "Lookup tables 1 & 2 must first be set");
        _;
    }

    modifier _onlyLUT3isSet() {
        require(
            LUT3_1_isSet == true && LUT3_2_isSet == true && LUT3_3_isSet == true && LUT3_4_isSet == true,
            "Lookup table 3 must first be set"
        );
        _;
    }
}
