use crate::contract::Fraction;

fn gcd_u32(mut a: u32, mut b: u32) -> u32 {
    while b != 0 {
        let r = a % b;
        a = b;
        b = r;
    }
    a
}

pub(crate) fn reduce_fraction(fraction: Fraction) -> Fraction {
    if fraction.numerator == 0 {
        return Fraction {
            numerator: 0,
            denominator: 1,
        };
    }
    let gcd = gcd_u32(fraction.numerator, fraction.denominator.max(1)).max(1);
    Fraction {
        numerator: fraction.numerator / gcd,
        denominator: fraction.denominator.max(1) / gcd,
    }
}

pub(crate) fn add_fractions(left: Fraction, right: Fraction) -> Fraction {
    reduce_fraction(Fraction {
        numerator: (left.numerator as u64 * right.denominator as u64
            + right.numerator as u64 * left.denominator as u64) as u32,
        denominator: (left.denominator as u64 * right.denominator as u64) as u32,
    })
}

pub(crate) fn subtract_fractions(left: Fraction, right: Fraction) -> Fraction {
    let left_scaled = left.numerator as i64 * right.denominator as i64;
    let right_scaled = right.numerator as i64 * left.denominator as i64;
    let numerator = (left_scaled - right_scaled).max(0) as u32;
    reduce_fraction(Fraction {
        numerator,
        denominator: (left.denominator as u64 * right.denominator as u64) as u32,
    })
}

pub(crate) fn compare_fractions(left: Fraction, right: Fraction) -> std::cmp::Ordering {
    (left.numerator as u64 * right.denominator as u64)
        .cmp(&(right.numerator as u64 * left.denominator as u64))
}

pub(crate) fn sort_and_dedup_fractions(fractions: &mut Vec<Fraction>) {
    fractions.sort_by(|left, right| compare_fractions(*left, *right));
    fractions.dedup_by(|left, right| compare_fractions(*left, *right) == std::cmp::Ordering::Equal);
}
