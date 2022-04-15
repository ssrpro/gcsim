package parse

import (
	"errors"
	"fmt"

	"github.com/genshinsim/gcsim/pkg/core"
)

func parseChar(p *Parser) (parseFn, error) {
	n := p.next()
	switch n.typ {
	case itemChar:
		return parseCharDetails, nil
	case itemAdd:
		return parseCharAdd, nil
	case itemActionKey:
		p.backup()
		return parseCharActions, nil
	default:
		return nil, fmt.Errorf("ln%v: unexpected token after <character>: %v", n.line, n)
	}
}

func (p *Parser) newChar(key core.CharKey) {
	r := core.CharacterProfile{}
	r.Base.Key = key
	r.Stats = make([]float64, len(core.StatTypeString))
	r.StatsByLabel = make(map[string][]float64)
	r.Params = make(map[string]int)
	r.Sets = make(map[string]int)
	r.SetParams = make(map[string]map[string]int)
	r.Weapon.Params = make(map[string]int)
	r.Base.StartHP = -1
	r.Base.Element = core.CharKeyToEle[key]
	p.chars[key] = &r
	p.charOrder = append(p.charOrder, key)
}

func parseCharDetails(p *Parser) (parseFn, error) {
	//xiangling c lvl=80/90 cons=4 talent=6,9,9;
	c := p.chars[p.currentCharKey]
	var err error
	var x item
	for n := p.next(); n.typ != itemEOF; n = p.next() {
		switch n.typ {
		case itemLvl:
			c.Base.Level, c.Base.MaxLevel, err = p.acceptLevelReturnBaseMax()
			//err check below
		case itemCons:
			x, err = p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err == nil {
				c.Base.Cons, err = itemNumberToInt(x)
			}
		case itemTalent:
			x, err = p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err != nil {
				return nil, err
			}
			c.Talents.Attack, err = itemNumberToInt(x)
			if err != nil {
				return nil, err
			}

			x, err = p.acceptSeqReturnLast(itemComma, itemNumber)
			if err != nil {
				return nil, err
			}
			c.Talents.Skill, err = itemNumberToInt(x)
			if err != nil {
				return nil, err
			}

			x, err = p.acceptSeqReturnLast(itemComma, itemNumber)
			if err != nil {
				return nil, err
			}
			c.Talents.Burst, err = itemNumberToInt(x)
			if err != nil {
				return nil, err
			}
		case itemStartHP:
			x, err = p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err == nil {
				c.Base.StartHP, err = itemNumberToFloat64(x)
			}
		case itemPlus: //optional flags
			n = p.next()
			switch n.typ {
			case itemParams:
				//expecting =[
				_, err = p.acceptSeqReturnLast(itemEqual, itemLeftSquareParen)
				if err != nil {
					return nil, fmt.Errorf("ln%v: invalid token after param; line %v", n.line, p.tokens)
				}
				p.backup()
				//overriding here if it already exists
				c.Params, err = p.acceptOptionalParamReturnMap()
			default:
				err = fmt.Errorf("ln%v: unexpected token after +: %v", n.line, n)
			}
		case itemTerminateLine:
			return parseRows, nil
		}
		if err != nil {
			return nil, err
		}
	}
	return nil, errors.New("unexpected end of line while parsing character")
}

func parseCharAdd(p *Parser) (parseFn, error) {
	//after add we expect either weapon, set, or stats
	n := p.next()
	switch n.typ {
	case itemWeapon:
		return parseCharAddWeapon, nil
	case itemSet:
		return parseCharAddSet, nil
	case itemStats:
		return parseCharAddStats, nil
	default:
		return nil, fmt.Errorf("ln%v: unexpected token after <character> add: %v", n.line, n)
	}
}

func parseCharAddSet(p *Parser) (parseFn, error) {
	//xiangling add set="seal of insulation" count=4;
	c := p.chars[p.currentCharKey]
	var err error
	var x item
	x, err = p.acceptSeqReturnLast(itemEqual, itemString)
	if err != nil {
		return nil, err
	}
	s := x.val
	if len(s) > 0 && s[0] == '"' {
		s = s[1:]
	}
	if len(s) > 0 && s[len(s)-1] == '"' {
		s = s[:len(s)-1]
	}
	label := s
	count := 0

	for n := p.next(); n.typ != itemEOF; n = p.next() {
		switch n.typ {
		case itemCount:
			x, err = p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err == nil {
				count, err = itemNumberToInt(x)
			}
		case itemPlus: //optional flags
			n = p.next()
			switch n.typ {
			case itemParams:
				//expecting =[
				_, err = p.acceptSeqReturnLast(itemEqual, itemLeftSquareParen)
				if err != nil {
					return nil, fmt.Errorf("ln%v: invalid token after param; line %v", n.line, p.tokens)
				}
				p.backup()
				//overriding here if it already exists
				c.SetParams[label], err = p.acceptOptionalParamReturnMap()
			default:
				err = fmt.Errorf("ln%v: unexpected token after +: %v", n.line, n)
			}
		case itemTerminateLine:
			c.Sets[label] = count
			return parseRows, nil
		default:
			return nil, fmt.Errorf("ln%v: unexpected token after in parsing sets: %v", n.line, n)
		}
		if err != nil {
			return nil, err
		}
	}
	return nil, errors.New("unexpected end of line while parsing character add set")
}

func parseCharAddWeapon(p *Parser) (parseFn, error) {
	//weapon="string name" lvl=??/?? refine=xx
	c := p.chars[p.currentCharKey]
	var err error
	var x item
	x, err = p.acceptSeqReturnLast(itemEqual, itemString)
	if err != nil {
		return nil, err
	}
	s := x.val
	if len(s) > 0 && s[0] == '"' {
		s = s[1:]
	}
	if len(s) > 0 && s[len(s)-1] == '"' {
		s = s[:len(s)-1]
	}
	c.Weapon.Name = s

	lvlOk := false
	refineOk := false

	for n := p.next(); n.typ != itemEOF; n = p.next() {
		switch n.typ {
		case itemLvl:
			c.Weapon.Level, c.Weapon.MaxLevel, err = p.acceptLevelReturnBaseMax()
			lvlOk = true
		case itemRefine:
			x, err = p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err == nil {
				c.Weapon.Refine, err = itemNumberToInt(x)
				refineOk = true
			}
		case itemPlus: //optional flags
			n = p.next()
			switch n.typ {
			case itemParams:
				//expecting =[
				_, err = p.acceptSeqReturnLast(itemEqual, itemLeftSquareParen)
				if err != nil {
					return nil, fmt.Errorf("ln%v: invalid token after param; line %v", n.line, p.tokens)
				}
				p.backup()
				//overriding here if it already exists
				c.Weapon.Params, err = p.acceptOptionalParamReturnMap()
			default:
				err = fmt.Errorf("ln%v: unexpected token after +: %v", n.line, n)
			}
		case itemTerminateLine:
			if !lvlOk {
				return nil, fmt.Errorf("ln%v: weapon %v missing lvl", n.line, s)
			}
			if !refineOk {
				return nil, fmt.Errorf("ln%v: weapon %v missing refine", n.line, s)
			}
			return parseRows, nil
		default:
			return nil, fmt.Errorf("ln%v: unrecognized token parsing add weapon: %v", n.line, n)
		}
		if err != nil {
			return nil, err
		}
	}
	return nil, errors.New("unexpected end of line while parsing character add weapon")
}

func parseCharAddStats(p *Parser) (parseFn, error) {
	//xiangling add stats hp=4780 atk=311 er=.518 pyro%=0.466 cr=0.311;
	c := p.chars[p.currentCharKey]

	//each line will be parsed separately into the map
	var line = make([]float64, len(core.StatTypeString))
	var key string
	var useAvg bool
	rarity := 5

	for n := p.next(); n.typ != itemEOF; n = p.next() {
		switch n.typ {
		case itemStatKey:
			x, err := p.acceptSeqReturnLast(itemEqual, itemNumber)
			if err != nil {
				return nil, err
			}
			amt, err := itemNumberToFloat64(x)
			if err != nil {
				return nil, err
			}
			pos := statKeys[n.val]
			line[pos] += amt
		case itemLabel:
			x, err := p.acceptSeqReturnLast(itemEqual, itemIdentifier)
			if err != nil {
				return nil, err
			}
			key = x.val
		case itemIdentifier:
			switch n.val {
			case "roll":
				x, err := p.acceptSeqReturnLast(itemEqual, itemIdentifier)
				if err != nil {
					return nil, err
				}
				//should be min, max, avg
				switch x.val {
				case "avg":
					useAvg = true
				}
			case "rarity":
				x, err := p.acceptSeqReturnLast(itemEqual, itemNumber)
				if err != nil {
					return nil, err
				}
				amt, err := itemNumberToInt(x)
				if err != nil {
					return nil, err
				}
				if amt > 5 {
					amt = 5
				}
				if amt < 1 {
					amt = 1
				}
				rarity = amt
			default:
				return nil, fmt.Errorf("ln%v: unrecognized token parsing add stats: %v", n.line, n)
			}
		case itemTerminateLine:
			//add stats into label
			m, ok := c.StatsByLabel[key]
			if !ok {
				m = make([]float64, len(core.StatTypeString))
			}
			for i, v := range line {
				if useAvg {
					c.Stats[i] += v * avgRoll[rarity-1][i]
					m[i] += v * avgRoll[rarity-1][i]
				} else {
					c.Stats[i] += v
					m[i] += v
				}
			}
			c.StatsByLabel[key] = m
			return parseRows, nil
		default:
			return nil, fmt.Errorf("ln%v: unrecognized token parsing add stats: %v", n.line, n)
		}
	}
	return nil, errors.New("unexpected end of line while parsing character add stats")
}

var avgRoll = [][]float64{
	//1
	{
		0, //n/a
		0, //def%
		0, //def
		0, //hp
		0, //hp%
		0, //atk
		0, //atk%
		0, //er
		0, //em
		0, //cr
		0, //cd
		0, //heal
		0, //pyro%
		0, //hydro%
		0, //cryo%
		0, //electro%
		0, //anemo%
		0, //geo%
		0, //phys%
		0, //dendro%
		0, //atkspd%
		0, //dmg%
	},
	//2
	{
		0, //n/a
		0, //def%
		0, //def
		0, //hp
		0, //hp%
		0, //atk
		0, //atk%
		0, //er
		0, //em
		0, //cr
		0, //cd
		0, //heal
		0, //pyro%
		0, //hydro%
		0, //cryo%
		0, //electro%
		0, //anemo%
		0, //geo%
		0, //phys%
		0, //dendro%
		0, //atkspd%
		0, //dmg%
	},
	//3
	{
		0, //n/a
		0, //def%
		0, //def
		0, //hp
		0, //hp%
		0, //atk
		0, //atk%
		0, //er
		0, //em
		0, //cr
		0, //cd
		0, //heal
		0, //pyro%
		0, //hydro%
		0, //cryo%
		0, //electro%
		0, //anemo%
		0, //geo%
		0, //phys%
		0, //dendro%
		0, //atkspd%
		0, //dmg%
	},
	//4
	{
		0, //n/a
		0, //def%
		0, //def
		0, //hp
		0, //hp%
		0, //atk
		0, //atk%
		0, //er
		0, //em
		0, //cr
		0, //cd
		0, //heal
		0, //pyro%
		0, //hydro%
		0, //cryo%
		0, //electro%
		0, //anemo%
		0, //geo%
		0, //phys%
		0, //dendro%
		0, //atkspd%
		0, //dmg%
	},
	//5
	{
		0,      //n/a
		0.0620, //def%
		19.68,  //def
		253.94, //hp
		0.0496, //hp%
		16.54,  //atk
		0.0496, //atk%
		0.0551, //er
		19.82,  //em
		0.0331, //cr
		0.0662, //cd
		0.359,  //heal
		0.466,  //pyro%
		0.466,  //hydro%
		0.466,  //cryo%
		0.466,  //electro%
		0.466,  //anemo%
		0.466,  //geo%
		0.583,  //phys%
		0.466,  //dendro%
		0,      //atkspd%
		0,      //dmg%
	},
}
